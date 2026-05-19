import urllib.request
import urllib.error
import json
import time
import asyncio
import websockets
import sys

BASE_URL = "http://localhost:8000"
WS_URL = "ws://localhost:8000/ws/events"

def http_get(path):
    url = f"{BASE_URL}{path}"
    req = urllib.request.Request(url)
    with urllib.request.urlopen(req) as res:
        return res.status, json.loads(res.read().decode('utf-8'))

def http_post(path, payload):
    url = f"{BASE_URL}{path}"
    data = json.dumps(payload).encode('utf-8')
    req = urllib.request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req) as res:
        return res.status, json.loads(res.read().decode('utf-8'))

async def test_websocket_multi_socket_and_sync():
    """Verify that multiple tabs/sockets register under the same user and receive broadcast events."""
    print("\n[TEST] 1. MULTI-SOCKET & REALTIME KAFKA BROADCAST SYNC")
    user_id = f"tester_ws_{int(time.time())}"
    
    # 1. First fetch to seed the user settings in PostgreSQL
    http_get(f"/settings/{user_id}")
    
    # 2. Open two concurrent WebSockets simulating two active tabs
    uri1 = f"{WS_URL}?user_id={user_id}"
    uri2 = f"{WS_URL}?user_id={user_id}"
    
    async with websockets.connect(uri1) as ws1, websockets.connect(uri2) as ws2:
        # Await connection established message
        msg1 = await ws1.recv()
        msg2 = await ws2.recv()
        
        print("  Socket 1 Initialized:", json.loads(msg1))
        print("  Socket 2 Initialized:", json.loads(msg2))
        
        # 3. Trigger a settings update via REST (simulates saving a change on Tab 1)
        payload = {
            "user_id": user_id,
            "theme": "light",
            "email_notifications": False,
            "push_notifications": True,
            "language": "en",
            "expected_version": 1
        }
        
        print("  Triggering REST settings update (Tab 1 action)...")
        status, updated_settings = http_post("/settings/update", payload)
        print(f"  Update HTTP Status: {status} | New Version: {updated_settings['version']}")
        
        # 4. Assert that BOTH sockets receive the realtime sync Kafka broadcast instantly!
        print("  Waiting to receive sync broadcast on Socket 1...")
        broadcast1 = await asyncio.wait_for(ws1.recv(), timeout=5)
        print("  Socket 1 received event:", json.loads(broadcast1))
        
        print("  Waiting to receive sync broadcast on Socket 2...")
        broadcast2 = await asyncio.wait_for(ws2.recv(), timeout=5)
        print("  Socket 2 received event:", json.loads(broadcast2))
        
        event1 = json.loads(broadcast1)
        event2 = json.loads(broadcast2)
        
        assert event1["event"] == "user.setting.updated"
        assert event1["payload"]["version"] == 2
        assert event2["payload"]["version"] == 2
        print("  => SUCCESS: Both sockets registered correctly and received realtime updates!")

def test_optimistic_concurrency_conflict():
    """Verify that a stale payload expected_version raises a 409 VERSION_CONFLICT error."""
    print("\n[TEST] 2. OPTIMISTIC CONCURRENCY CONTROL (OCC) VERSION CONFLICT")
    user_id = f"tester_occ_{int(time.time())}"
    
    # 1. Fetch initial settings (starts at version 1)
    status, initial = http_get(f"/settings/{user_id}")
    version_v1 = initial["version"]
    print(f"  Initial state fetched. Version: {version_v1}")
    
    # 2. Perform a successful update 1 (advances version to 2)
    payload_ok = {
        "user_id": user_id,
        "theme": "light",
        "email_notifications": False,
        "push_notifications": True,
        "language": "en",
        "expected_version": version_v1
    }
    status, updated = http_post("/settings/update", payload_ok)
    version_v2 = updated["version"]
    print(f"  First update successful. New Version: {version_v2}")
    
    # 3. Attempt a stale update using outdated version_v1 (simulating a stale background tab)
    payload_stale = {
        "user_id": user_id,
        "theme": "dark",
        "email_notifications": True,
        "push_notifications": False,
        "language": "fr",
        "expected_version": version_v1  # Stale! DB expects version_v2 (2)
    }
    
    print("  Triggering update with stale expected_version...")
    try:
        http_post("/settings/update", payload_stale)
        print("  [ERROR] Stale update succeeded when it should have failed!")
        sys.exit(1)
    except urllib.error.HTTPError as e:
        assert e.code == 409
        error_body = json.loads(e.read().decode('utf-8'))
        print(f"  Expected OCC Conflict HTTP Status: {e.code}")
        print(f"  Conflict Details:\n{json.dumps(error_body, indent=2)}")
        
        # Verify conflict schema structure
        detail = error_body["detail"]
        assert detail["error"] == "VERSION_CONFLICT"
        assert detail["current_version"] == version_v2
        assert detail["current_state"]["theme"] == "light"
        print("  => SUCCESS: OCC blocked stale overwrite and returned 409 conflict parameters!")

async def test_heartbeat_idle_timeout():
    """Verify that a socket that sends no heartbeat signals is evicted after 15s idle."""
    print("\n[TEST] 3. WEBSOCKET HEARTBEAT IDLE TIMEOUT EVICTION")
    user_id = f"tester_heartbeat_{int(time.time())}"
    
    uri = f"{WS_URL}?user_id={user_id}"
    print("  Connecting to server WebSocket...")
    async with websockets.connect(uri) as ws:
        # Await connection confirmation
        msg = await ws.recv()
        print("  Connection confirmed:", json.loads(msg))
        
        # Wait 16 seconds without sending any messages or heartbeats
        print("  Sleeping for 16 seconds to trigger idle eviction timeout (>15s)...")
        await asyncio.sleep(16.5)
        
        print("  Verifying if WebSocket has been evicted by the server health monitor...")
        try:
            # Attempt to read from the socket, expecting connection close
            await asyncio.wait_for(ws.recv(), timeout=2.0)
            print("  [ERROR] WebSocket remained open after idle heartbeat timeout!")
            sys.exit(1)
        except websockets.exceptions.ConnectionClosed as e:
            print(f"  WebSocket successfully closed by server monitor. Code: {e.code} | Reason: {e.reason}")
            assert e.code == 1001 or e.code == 1000
            print("  => SUCCESS: Connection manager safely evicted idle stale socket connection!")

async def run_all():
    print("=========================================================================")
    print("        FASTAPI SYNC ENGINE RELIABILITY & CONCURRENCY SUITE              ")
    print("=========================================================================")
    
    # Run REST Concurrency OCC test
    test_optimistic_concurrency_conflict()
    
    # Run WS Event Broadcasting Multi-socket test
    await test_websocket_multi_socket_and_sync()
    
    # Run Idle Heartbeat timeout eviction test
    await test_heartbeat_idle_timeout()

    print("\n=========================================================================")
    print("          ALL RELIABILITY AND CONCURRENCY TESTS PASSED!                  ")
    print("=========================================================================")

if __name__ == "__main__":
    asyncio.run(run_all())
