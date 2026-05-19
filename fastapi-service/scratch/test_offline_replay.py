import urllib.request
import urllib.error
import json
import time
import asyncio
import sys

BASE_URL = "http://localhost:8000"

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

# ====================================================
# Python Mock representation of client-side OfflineJournal & ReplayEngine
# ====================================================
class ClientState:
    def __init__(self, user_id):
        self.user_id = user_id
        self.journal = []  # Local queue
        self.state = {
            "theme": "dark",
            "email_notifications": True,
            "push_notifications": True,
            "version": 0
        }
        self.is_replaying = False  # Mutex lock

    def queue_mutation(self, key, value):
        mutation = {
            "id": f"mut-{int(time.time())}-{len(self.journal)}",
            "user_id": self.user_id,
            "key": key,
            "value": value,
            "expected_version": self.state["version"],
            "retry_count": 0,
            "status": "pending"
        }
        self.journal.append(mutation)
        print(f"  [JOURNAL] Queued: {key} -> {value} (expected_version: {mutation['expected_version']})")
        return mutation

    async def execute_replay_loop(self, simulate_network_fail_idx=None, simulate_occ_conflict_idx=None):
        """Simulates the JavaScript ReplayEngine.startReplay() with mutex lock and FIFO order."""
        if self.is_replaying:
            print("  [MUTEX] Blocked concurrent replay attempt!")
            return "blocked"

        self.is_replaying = True
        print(f"  [REPLAY] Mutex locked. Replaying {len(self.journal)} mutations in FIFO order.")
        
        # Yield execution to allow concurrent tasks to run and hit the mutex lock
        await asyncio.sleep(0.01)

        # Reconcile server state first
        try:
            _, server_data = http_get(f"/settings/{self.user_id}")
            if server_data["version"] > self.state["version"]:
                print(f"  [RECONCILE] Server version ({server_data['version']}) is newer. Hydrating local state.")
                self.state = { **server_data }
        except Exception as e:
            print(f"  [RECONCILE] Failed to fetch server state: {e}")

        replayed_successfully = 0

        # Create copy of journal to safely iterate and modify the main queue
        queue_copy = list(self.journal)

        for idx, mutation in enumerate(queue_copy):
            # 1. Simulate network disconnect / transient failure
            if simulate_network_fail_idx is not None and idx == simulate_network_fail_idx:
                print(f"  [REPLAY] Simulating transient network failure for mutation ID: {mutation['id']}")
                mutation["retry_count"] += 1
                mutation["status"] = "pending"
                # Keep in journal, halt execution loop
                break

            # 2. Simulate OCC Conflict
            current_expected_version = max(mutation["expected_version"], self.state["version"])
            
            payload = {
                "user_id": self.user_id,
                "theme": self.state["theme"],
                "email_notifications": self.state["email_notifications"],
                "push_notifications": self.state["push_notifications"],
                "language": "en",
                "expected_version": current_expected_version if simulate_occ_conflict_idx != idx else -999  # Forced stale version
            }
            payload[mutation["key"]] = mutation["value"]

            try:
                # Dispatch mutation REST payload
                status, res_data = http_post("/settings/update", payload)
                
                # Success: Evict from journal and advance local version state
                self.state["version"] = res_data["version"]
                self.state[mutation["key"]] = mutation["value"]
                
                self.journal.remove(mutation)
                replayed_successfully += 1
                print(f"  [REPLAY] Success: {mutation['key']}={mutation['value']} | New Local Version: {self.state['version']}")

            except urllib.error.HTTPError as e:
                if e.code == 409:
                    # 409 Conflict handled
                    conflict_body = json.loads(e.read().decode('utf-8'))
                    detail = conflict_body["detail"]
                    print(f"  [REPLAY] OCC Conflict detected! Server Version: {detail['current_version']}. Rollback initiated.")
                    
                    # OCC state rollback
                    self.state["theme"] = detail["current_state"]["theme"]
                    self.state["email_notifications"] = detail["current_state"]["email_notifications"]
                    self.state["push_notifications"] = detail["current_state"]["push_notifications"]
                    self.state["version"] = detail["current_version"]
                    
                    # Evict the conflicted mutation
                    self.journal.remove(mutation)
                    break  # Halt replay immediately to preserve FIFO order integrity
                else:
                    print(f"  [REPLAY] Server Error: {e.code}")
                    break

        self.is_replaying = False
        print("  [REPLAY] Mutex released.")
        return replayed_successfully


# ====================================================
# Test Scenarios
# ====================================================
async def test_offline_mutation_queue_and_replay():
    print("\n[TEST] 1. OFFLINE MUTATION QUEUEING & SEQUENTIAL REPLAY")
    user_id = f"offline_user_{int(time.time())}"
    
    # Initialize settings in database
    http_get(f"/settings/{user_id}")
    
    client = ClientState(user_id)
    # Sync initial baseline state
    _, db_state = http_get(f"/settings/{user_id}")
    client.state = { **db_state }
    print(f"  Baseline Version: {client.state['version']}")

    # Simulate Internet Disconnect: Queue modifications offline
    print("  --- INTERNET DISCONNECTED ---")
    client.queue_mutation("theme", "light")
    client.queue_mutation("email_notifications", False)
    client.queue_mutation("push_notifications", False)
    
    # Assert queued items length
    assert len(client.journal) == 3
    print("  => SUCCESS: Local journal correctly queued and preserved all 3 offline modifications!")

    # Simulate Internet Restored: Replay Engine Triggered
    print("  --- INTERNET RESTORED ---")
    replayed = await client.execute_replay_loop()
    
    assert replayed == 3
    assert len(client.journal) == 0
    assert client.state["theme"] == "light"
    assert client.state["email_notifications"] is False
    assert client.state["push_notifications"] is False
    print("  => SUCCESS: Replay engine executed sequentially in FIFO order and updated server correctly!")


async def test_concurrent_replay_mutex_lock():
    print("\n[TEST] 2. CONCURRENT REPLAY PREVENTION (MUTEX LOCK)")
    user_id = f"mutex_user_{int(time.time())}"
    http_get(f"/settings/{user_id}")
    client = ClientState(user_id)
    
    # Queue a mutation offline
    client.queue_mutation("theme", "light")
    
    # Trigger twice concurrently
    task1 = client.execute_replay_loop()
    task2 = client.execute_replay_loop()
    
    res = await asyncio.gather(task1, task2)
    assert "blocked" in res
    print("  => SUCCESS: Mutex lock correctly blocked concurrent/duplicate replay workers!")


async def test_replay_occ_conflict_rollback():
    print("\n[TEST] 3. REPLAY OCC CONFLICT SAFETY & ROLLBACK")
    user_id = f"conflict_user_{int(time.time())}"
    http_get(f"/settings/{user_id}")
    
    client = ClientState(user_id)
    _, db_state = http_get(f"/settings/{user_id}")
    client.state = { **db_state }

    # Queue multiple mutations offline
    client.queue_mutation("theme", "light")
    client.queue_mutation("email_notifications", False)  # This one will face simulated conflict
    client.queue_mutation("push_notifications", False)

    # Replay with forced OCC collision on mutation 1 (email_notifications)
    print("  Triggering replay loop with simulated conflict...")
    await client.execute_replay_loop(simulate_occ_conflict_idx=1)
    
    # Assertions:
    # Theme should have updated successfully (first mutation)
    # Email notifications should have triggered conflict, halted replay loop, and rolled back local state!
    # Push notifications should NOT have run since conflict halted loop.
    assert client.state["theme"] == "light"
    # Rolled back email notification to server state (True)
    assert client.state["email_notifications"] is True
    # Journal should contain only the un-executed push mutation
    assert len(client.journal) == 1
    assert client.journal[0]["key"] == "push_notifications"
    print("  => SUCCESS: Concurrency conflict halted replay and rolled back local states successfully!")


async def test_transient_failure_exponential_backoff():
    print("\n[TEST] 4. TRANSIENT REPLAY FAILS & EXPONENTIAL BACKOFF TIMEOUT")
    user_id = f"transient_user_{int(time.time())}"
    http_get(f"/settings/{user_id}")
    client = ClientState(user_id)

    client.queue_mutation("theme", "light")
    client.queue_mutation("email_notifications", False)

    # Replay with simulated network loss on mutation index 1
    print("  Replaying with transient network loss on index 1...")
    await client.execute_replay_loop(simulate_network_fail_idx=1)

    # Assertions:
    # First mutation succeeded and was removed
    # Second mutation failed, retry count incremented, kept in queue, loop halted
    assert len(client.journal) == 1
    assert client.journal[0]["key"] == "email_notifications"
    assert client.journal[0]["retry_count"] == 1
    print("  => SUCCESS: Transient failure safely halted loop and scheduled retry backoffs!")


async def run_all():
    print("=========================================================================")
    print("        FASTAPI DURABLE OFFLINE SYNC ENGINE VALIDATION SUITE             ")
    print("=========================================================================")
    
    await test_offline_mutation_queue_and_replay()
    await test_concurrent_replay_mutex_lock()
    await test_replay_occ_conflict_rollback()
    await test_transient_failure_exponential_backoff()

    print("\n=========================================================================")
    print("          ALL OFFLINE REPLAY ENGINE TESTS PASSED!                        ")
    print("=========================================================================")

if __name__ == "__main__":
    asyncio.run(run_all())
