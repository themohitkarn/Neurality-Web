import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from app.config import settings
from app.core.redis import redis_manager
from app.core.kafka import kafka_manager

# Configure logging style
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("fastapi-app")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # --- STARTUP EVENT ---
    logger.info("FastAPI service is starting up...")
    
    # 1. Auto-create database tables in PostgreSQL asynchronously (Priority Database Setup)
    from app.models.base import Base
    from app.core.db import engine
    import app.models.user_settings  # Ensure model is imported so metadata registers it
    import app.models.user           # Ensure User table metadata is registered
    import app.models.notification   # Ensure Notification tables are registered
    import app.models.privacy        # Ensure Privacy/UserEdge table metadata is registered
    import app.models.feature_flag   # Ensure FeatureFlag table metadata is registered
    try:
        logger.info("Provisioning database tables asynchronously...")
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.info("Database tables provisioned successfully.")
    except Exception as e:
        logger.error(f"Failed to provision database tables: {str(e)}")

    # 2. Connect Redis Manager
    try:
        await redis_manager.connect()
    except Exception as e:
        logger.error(f"Failed to connect Redis at startup: {str(e)}")
        
    # 3. Connect Kafka Manager
    try:
        kafka_manager.connect()
        # Start background Kafka consumer daemon thread with the active event loop reference
        import asyncio
        loop = asyncio.get_running_loop()
        from app.core.kafka import kafka_consumer
        kafka_consumer.start(loop=loop)
    except Exception as e:
        logger.error(f"Failed to initialize Kafka Producer/Consumer at startup: {str(e)}")
        
    # 4. Start WebSocket Heartbeat Eviction Daemon Task
    from app.core.websocket import ws_manager
    ws_monitor_task = asyncio.create_task(ws_manager.monitor_heartbeats())

    # 5. Start Redis Pub/Sub Subscriber Worker Task
    from app.core.redis import redis_pubsub_subscriber_loop
    redis_sub_task = asyncio.create_task(redis_pubsub_subscriber_loop())

    # 6. Start Notification Delivery Retry Daemon Task
    from app.core.notification_service import NotificationService
    retry_task = asyncio.create_task(NotificationService.run_retry_loop())
        
    yield
    
    # --- SHUTDOWN EVENT ---
    logger.info("FastAPI service is shutting down...")
    
    # Terminate background Redis Pub/Sub loop safely
    redis_sub_task.cancel()
    try:
        await redis_sub_task
    except asyncio.CancelledError:
        pass
    
    # Terminate background WebSocket heartbeat loop safely
    ws_manager.is_monitoring = False
    ws_monitor_task.cancel()
    try:
        await ws_monitor_task
    except asyncio.CancelledError:
        pass

    # Terminate background Notification retry loop safely
    retry_task.cancel()
    try:
        await retry_task
    except asyncio.CancelledError:
        pass

    from app.core.kafka import kafka_consumer
    try:
        kafka_consumer.stop()
    except Exception as e:
        logger.error(f"Failed to cleanly stop Kafka consumer: {str(e)}")
    await redis_manager.disconnect()
    kafka_manager.disconnect()

app = FastAPI(
    title="FastAPI Real-Time Events Stack",
    description="Production-grade template supporting REST, PostgreSQL, Redis caching, Kafka, and WebSockets.",
    version="1.0.0",
    lifespan=lifespan
)

# ── Register UserSettings API Router ──
from app.api.user_settings import router as settings_router
app.include_router(settings_router)

# ── Register Auth API Router ──
from app.api.auth import router as auth_router
app.include_router(auth_router)

# ── Register Notifications API Router ──
from app.api.notifications import router as notifications_router
app.include_router(notifications_router)

# ── Register Privacy Graph API Router ──
from app.api.privacy import router as privacy_router
app.include_router(privacy_router)

# ── Register Feature Flags API Router ──
from app.api.features import router as features_router
app.include_router(features_router)

# ── Realtime Settings Sync Frontend ──
import os
from fastapi.responses import HTMLResponse

@app.get("/", response_class=HTMLResponse)
async def root():
    template_path = os.path.join(os.path.dirname(__file__), "templates", "index.html")
    try:
        with open(template_path, "r", encoding="utf-8") as f:
            return HTMLResponse(content=f.read())
    except FileNotFoundError:
        return HTMLResponse(content="<h1>Realtime Sync Dashboard templates not found.</h1>", status_code=404)

@app.get("/metrics/notifications")
async def get_notification_metrics():
    """Retrieve observability metrics snapshot for the notification delivery system."""
    from app.core.metrics import NotificationMetrics
    metrics = await NotificationMetrics.get_all_metrics()
    return metrics

@app.get("/metrics/privacy")
async def get_privacy_metrics():
    """Retrieve observability metrics snapshot for the social privacy graph system."""
    from app.core.privacy_metrics import PrivacyMetrics
    metrics = await PrivacyMetrics.get_all_metrics()
    return metrics

@app.get("/metrics/features")
async def get_feature_metrics():
    """Retrieve observability metrics snapshot for the feature flag and experimentation system."""
    from app.core.feature_metrics import FeatureMetrics
    metrics = await FeatureMetrics.get_all_metrics()
    return metrics

# ── Registered Secure WebSocket Connection Endpoint ──
from app.core.websocket import ws_manager
from app.core.security import decode_token
from app.core.redis import redis_manager

@app.websocket("/ws/events")
async def websocket_endpoint(websocket: WebSocket, token: str = None):
    # 1. Extract token from query params if not explicitly parsed by route
    if not token:
        token = websocket.query_params.get("token")

    if not token:
        await websocket.accept()
        await websocket.send_json({"error": "AUTHENTICATION_FAILED", "message": "Missing authentication token"})
        await websocket.close(code=3000, reason="Missing token")
        return

    # 2. Decode and Validate JWT signature & claims
    payload = decode_token(token)
    if not payload or payload.get("type") != "access":
        await websocket.accept()
        await websocket.send_json({"error": "AUTHENTICATION_FAILED", "message": "Invalid or expired token"})
        await websocket.close(code=3000, reason="Invalid token")
        return

    user_id = payload.get("sub")
    session_id = payload.get("session_id")

    # 3. Check active session status in Redis (supports instant global revocation)
    session_key = f"session:{user_id}:{session_id}"
    session_active = await redis_manager.get_json(session_key)
    if not session_active or session_active.get("status") != "active":
        await websocket.accept()
        await websocket.send_json({"error": "AUTHENTICATION_FAILED", "message": "Session revoked or expired"})
        await websocket.close(code=3000, reason="Session revoked")
        return

    # Securely register socket under authenticated user_id
    await ws_manager.connect(user_id, websocket)
    try:
        await websocket.send_json({
            "event": "connection_established",
            "message": "Welcome to the secure real-time event pipeline!",
            "user_id": user_id
        })
        while True:
            # Receive incoming text message/heartbeats from client
            data = await websocket.receive_text()
            
            # Simple JSON heartbeat ping/pong support
            try:
                import json
                msg = json.loads(data)
                if msg.get("type") == "ping":
                    # Instant session revocation validation during pings!
                    session_still_active = await redis_manager.get_json(session_key)
                    if not session_still_active or session_still_active.get("status") != "active":
                        logger.warning(f"Session revoked during active socket connection. Evicting user '{user_id}'...")
                        await websocket.send_json({"error": "SESSION_REVOKED", "message": "Session was closed"})
                        break
                        
                    await ws_manager.register_heartbeat(websocket)
                    await websocket.send_json({"type": "pong"})
                    continue
            except Exception:
                pass
                
            logger.info(f"WebSocket message received from securely authenticated user '{user_id}': {data}")
    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected for user '{user_id}'")
    except Exception as e:
        logger.error(f"WebSocket error for user '{user_id}': {str(e)}")
    finally:
        ws_manager.disconnect(user_id, websocket)
