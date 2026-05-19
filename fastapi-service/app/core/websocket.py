import logging
import time
import asyncio
from typing import Dict, List
from fastapi import WebSocket

logger = logging.getLogger("fastapi-app")

class ConnectionManager:
    def __init__(self):
        # Maps user_id -> List of active WebSockets (supports multiple tabs!)
        self.active_connections: Dict[str, List[WebSocket]] = {}
        # Tracks last heartbeat timestamp for each WebSocket
        self.last_heartbeat: Dict[WebSocket, float] = {}
        # Monitor runner state
        self.is_monitoring = False

    async def connect(self, user_id: str, websocket: WebSocket):
        """Accept connection, register socket under user_id, and track heartbeat."""
        await websocket.accept()
        
        if user_id not in self.active_connections:
            self.active_connections[user_id] = []
            
        self.active_connections[user_id].append(websocket)
        self.last_heartbeat[websocket] = time.time()
        
        logger.info(f"WebSocket registered for user '{user_id}'. Sockets for user: {len(self.active_connections[user_id])}")

    def disconnect(self, user_id: str, websocket: WebSocket):
        """Cleanly remove socket from registry and heartbeat tracking."""
        if user_id in self.active_connections:
            if websocket in self.active_connections[user_id]:
                self.active_connections[user_id].remove(websocket)
                logger.info(f"WebSocket closed for user '{user_id}'. Remaining: {len(self.active_connections[user_id])}")
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]
                logger.info(f"No active sockets left for user '{user_id}'. Evicted user from registry.")

        if websocket in self.last_heartbeat:
            del self.last_heartbeat[websocket]

    async def register_heartbeat(self, websocket: WebSocket):
        """Update last active timestamp for the connection."""
        self.last_heartbeat[websocket] = time.time()

    def has_connections(self, user_id: str) -> bool:
        """Check if this instance has local socket connections for user_id."""
        return user_id in self.active_connections

    async def broadcast_local(self, user_id: str, message: dict) -> int:
        """Directly send JSON message to all local socket connections for this user_id."""
        # Enforce Real-time Privacy Graph Blocks on Websocket Delivery
        payload = message.get("payload") or {}
        actor_id = payload.get("actor_id") or payload.get("source_id") or payload.get("source_user_id")
        if actor_id and str(actor_id) != str(user_id):
            from app.core.privacy_service import PrivacyService
            if await PrivacyService.is_blocked(str(user_id), str(actor_id)) or await PrivacyService.is_blocked(str(actor_id), str(user_id)):
                logger.info(f"[WS PRIVACY ENFORCEMENT] Suppressed WS broadcast: block exists between user '{user_id}' and actor '{actor_id}'.")
                return 0

        sockets = self.active_connections.get(user_id)
        if not sockets:
            return 0
            
        sent_count = 0
        for s in list(sockets):
            try:
                await s.send_json(message)
                sent_count += 1
            except Exception as e:
                logger.error(f"Failed local broadcast to socket for user '{user_id}': {str(e)}. Evicting...")
                self.disconnect(user_id, s)
        return sent_count

    async def broadcast(self, message: dict):
        """Broadcast message to the entire cluster via Redis Pub/Sub event propagation."""
        payload = message.get("payload", {})
        user_id = payload.get("user_id")
        if not user_id:
            logger.error("Broadcast aborted: No user_id found in message payload.")
            return

        channel = f"user:{user_id}:settings"
        from app.core.redis import redis_manager
        await redis_manager.publish_event(channel, payload)

    async def monitor_heartbeats(self):
        """Background loop that polls connection health and evicts stale connections (>15s idle)."""
        self.is_monitoring = True
        logger.info("Background WebSocket connection health monitoring daemon active.")
        
        while self.is_monitoring:
            try:
                await asyncio.sleep(5)
                current_time = time.time()
                stale_sockets = []

                for s, last_active in list(self.last_heartbeat.items()):
                    if current_time - last_active > 15.0:
                        stale_sockets.append(s)

                for ws in stale_sockets:
                    logger.warning(f"Connection heartbeat timeout exceeded. Evicting stale WebSocket...")
                    # Find associated user_id to disconnect
                    found_user = None
                    for user_id, sockets in list(self.active_connections.items()):
                        if ws in sockets:
                            found_user = user_id
                            break
                    
                    if found_user:
                        try:
                            await ws.close(code=1001, reason="Heartbeat timeout exceeded")
                        except Exception:
                            pass
                        self.disconnect(found_user, ws)
            except asyncio.CancelledError:
                break
            except Exception as ex:
                logger.error(f"Error in heartbeat monitoring loop: {str(ex)}")

        logger.info("Heartbeat monitoring loop stopped.")

ws_manager = ConnectionManager()
