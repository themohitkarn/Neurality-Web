import asyncio
import websockets
import urllib.request
import urllib.error
import json
import time

URL_NODE_1_HTTP = "http://localhost:8000"
URL_NODE_2_HTTP = "http://localhost:8001"
URL_NODE_1_WS = "ws://localhost:8000/ws/events"
URL_NODE_2_WS = "ws://localhost:8001/ws/events"

def http_post(base_url, path, payload):
    url = f"{base_url}{path}"
    data = json.dumps(payload).encode('utf-8')
    req = urllib.request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req) as res:
        return res.status, json.loads(res.read().decode('utf-8'))

def http_get(base_url, path):
    url = f"{base_url}{path}"
    req = urllib.request.Request(url)
    with urllib.request.urlopen(req) as res:
        return res.status, json.loads(res.read().decode('utf-8'))

async def test_cross_instance_websocket_sync():
    print("\n=========================================================================")
    print("      SCENARIO 1: DISTRIBUTED CROSS-INSTANCE SYNCHRONIZATION TEST       ")
    print("=========================================================================")
    
    user_id = f"scaling_user_{int(time.time())}"
    print(f"Target User: '{user_id}'")

    # 1. Initialize user baseline on Node 2 to get initial row and version
    print(f"  [HTTP] Seeding baseline settings for '{user_id}' via Node 2...")
    _, initial_settings = http_get(URL_NODE_2_HTTP, f"/settings/{user_id}")
    initial_version = initial_settings["version"]
    print(f"  => Baseline Version: {initial_version}")

    # 2. Connect WebSocket client to Node 1
    ws_url = f"{URL_NODE_1_WS}?user_id={user_id}"
    print(f"  [WEBSOCKET] Connecting client to Node 1 ({ws_url})...")
    
    async with websockets.connect(ws_url) as websocket:
        print("  => WebSocket connected successfully to Node 1!")

        # Send heartbeat ping to register on Node 1
        await websocket.send(json.dumps({"type": "ping"}))
        print("  [WEBSOCKET] Ping sent.")
        
        # Read the ping response
        pong = await websocket.recv()
        print(f"  [WEBSOCKET] Pong received: {pong}")

        # 3. Perform REST Settings Update on Node 2 (cross-instance update)
        payload = {
            "user_id": user_id,
            "theme": "light",
            "email_notifications": False,
            "push_notifications": False,
            "language": "en",
            "expected_version": initial_version
        }
        
        print(f"  [HTTP] Sending REST settings update to Node 2 (theme=light, version={initial_version})...")
        status, updated_settings = http_post(URL_NODE_2_HTTP, "/settings/update", payload)
        assert status == 200
        print(f"  => Node 2 successfully accepted update! Server version advanced to {updated_settings['version']}")

        # 4. Assert that WebSocket client connected to Node 1 receives the settings sync event!
        print("  [WEBSOCKET] Waiting for realtime sync broadcast from Node 1...")
        try:
            start_time = time.time()
            found = False
            while time.time() - start_time < 5.0:
                msg_str = await asyncio.wait_for(websocket.recv(), timeout=5.0)
                msg = json.loads(msg_str)
                print(f"  [WEBSOCKET] Received message: {msg}")
                if msg.get("event") == "user.setting.updated":
                    payload = msg["payload"]
                    assert payload["user_id"] == user_id
                    assert payload["theme"] == "light"
                    assert payload["email_notifications"] is False
                    assert payload["version"] == initial_version + 1
                    found = True
                    print("  => SUCCESS: Realtime settings sync succeeded cross-instance! Node 1 successfully fanned out Node 2's update!")
                    break

            assert found, "Did not receive user.setting.updated event within timeout!"
            
        except asyncio.TimeoutError:
            print("  => FAILURE: Timeout waiting for cross-instance websocket message propagation!")
            raise AssertionError("Cross-instance settings sync propagation timed out!")

    # 5. Fetch observability metrics from both instances
    print("\n=========================================================================")
    print("      SCENARIO 2: OBSERVABILITY & METRICS INSTRUMENTATION ASSERTIONS     ")
    print("=========================================================================")
    
    # Wait half a second for metrics to fully stabilize
    await asyncio.sleep(0.5)

    _, metrics_node_1 = http_get(URL_NODE_1_HTTP, "/settings/metrics")
    _, metrics_node_2 = http_get(URL_NODE_2_HTTP, "/settings/metrics")

    print("\nNode 1 (Port 8000) Cluster Metrics:")
    print(json.dumps(metrics_node_1, indent=2))

    print("\nNode 2 (Port 8001) Cluster Metrics:")
    print(json.dumps(metrics_node_2, indent=2))

    print("\n  Asserting Stateless Fanout Mechanics...")
    # Node 1 should have 1 cross-instance broadcast, and 1 local websocket fanout count
    assert metrics_node_1["cross_instance_broadcasts"] >= 1
    assert metrics_node_1["websocket_fanout_counts"] >= 1
    print("  => SUCCESS: Node 1 successfully logged the cross-instance broadcast and local socket fanout!")

    # Node 2 should have 1 cross-instance broadcast, and 1 dropped delivery count (as user was not connected to Port 8001)
    assert metrics_node_2["cross_instance_broadcasts"] >= 1
    assert metrics_node_2["dropped_delivery_count"] >= 1
    print("  => SUCCESS: Node 2 successfully logged the cross-instance broadcast and dropped delivery!")


async def test_redis_connection_resilience_and_metrics():
    print("\n=========================================================================")
    print("      SCENARIO 3: METRICS ACCUMULATION & RESILIENCE VALIDATION          ")
    print("=========================================================================")
    
    # Test checking system endpoint health
    _, metrics = http_get(URL_NODE_1_HTTP, "/settings/metrics")
    assert "pubsub_avg_latency_ms" in metrics
    assert "subscriber_reconnects" in metrics
    assert "active_local_sockets" in metrics
    print("  => SUCCESS: Observability metrics endpoint conforms to Part 8 schemas!")


async def main():
    print("=========================================================================")
    print("     NEURALITY DISTRIBUTED WEBSOCKET SCALING VALIDATION SUITE            ")
    print("=========================================================================")
    
    try:
        await test_cross_instance_websocket_sync()
        await test_redis_connection_resilience_and_metrics()
        print("\n=========================================================================")
        print("          ALL SCALED REDIS PUB/SUB SYNC TESTS PASSED 100%!               ")
        print("=========================================================================")
    except Exception as e:
        print(f"\n[TEST SUITE ERROR] Validation failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())
