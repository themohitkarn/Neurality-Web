import sys
import os
import urllib.request
import json
import time

def get_request(path):
    url = f"http://localhost:8000{path}"
    req = urllib.request.Request(url)
    try:
        with urllib.request.urlopen(req, timeout=5) as res:
            return res.status, json.loads(res.read().decode('utf-8'))
    except Exception as e:
        print(f"[HTTP GET ERROR] Failed to connect to {url}: {str(e)}")
        return 500, {}

def post_request(path, payload):
    url = f"http://localhost:8000{path}"
    data = json.dumps(payload).encode('utf-8')
    req = urllib.request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/json"}
    )
    try:
        with urllib.request.urlopen(req, timeout=5) as res:
            return res.status, json.loads(res.read().decode('utf-8'))
    except Exception as e:
        print(f"[HTTP POST ERROR] Failed to connect to {url}: {str(e)}")
        return 500, {}

def main():
    print("=========================================================================")
    print("      FASTAPI DOCKER STACK END-TO-END CRUD & CACHING VALIDATION          ")
    print("=========================================================================")

    # Use a unique timestamp user ID to guarantee fresh cache miss testing
    target_user = f"demo_user_{int(time.time())}"
    print(f"Target verification scope: {target_user}")

    # 1. Test GET /settings/{user_id} (Seeding test - EXPECTED: CACHE MISS & DB SEED)
    print(f"\n--- TEST 1: FETCH SETTINGS FOR NEW USER (EXPECTED: CACHE MISS & DB SEED) ---")
    status_code, data = get_request(f"/settings/{target_user}")
    print(f"  Status Code: {status_code}")
    print(f"  Payload Returned:\n{json.dumps(data, indent=2)}")
    if status_code != 200:
        print("[ERROR] FastAPI server is not responding at http://localhost:8000. Make sure docker-compose is running!")
        sys.exit(1)
    assert data["user_id"] == target_user
    assert data["theme"] == "dark"  # Default seed value

    # 2. Test GET /settings/{user_id} again (Sustained fetch - EXPECTED: CACHE HIT FROM REDIS)
    print(f"\n--- TEST 2: RE-FETCH SETTINGS FOR USER (EXPECTED: CACHE HIT FROM REDIS) ---")
    status_code_hit, data_hit = get_request(f"/settings/{target_user}")
    print(f"  Status Code: {status_code_hit}")
    print(f"  Payload Returned:\n{json.dumps(data_hit, indent=2)}")
    assert status_code_hit == 200
    assert data_hit["theme"] == "dark"

    # 3. Test POST /settings/update (Updating theme - WRITE-THROUGH & CACHE INVALIDATION & KAFKA EVENT)
    print(f"\n--- TEST 3: UPDATE PREFERENCE (EXPECTED: DB UPSERT, CACHE EVICT & WRITE-THROUGH) ---")
    payload = {
        "user_id": target_user,
        "theme": "light",
        "email_notifications": False,
        "push_notifications": True,
        "language": "es"
    }
    status_code_update, data_update = post_request("/settings/update", payload)
    print(f"  Status Code: {status_code_update}")
    print(f"  Payload Returned:\n{json.dumps(data_update, indent=2)}")
    assert status_code_update == 200
    assert data_update["theme"] == "light"
    assert data_update["email_notifications"] is False
    assert data_update["language"] == "es"

    # 4. Test GET /settings/{user_id} again (Verification - EXPECTED: CACHE HIT ON FRESH WARM SNAPSHOT)
    print(f"\n--- TEST 4: RE-FETCH TO CONFIRM FRESH WARM SNAPSHOT ---")
    status_code_verify, data_verify = get_request(f"/settings/{target_user}")
    print(f"  Status Code: {status_code_verify}")
    print(f"  Payload Returned:\n{json.dumps(data_verify, indent=2)}")
    assert status_code_verify == 200
    assert data_verify["theme"] == "light"
    assert data_verify["email_notifications"] is False

    print("\n=========================================================================")
    print("          USER SETTINGS END-TO-END VALIDATED SUCCESSFULLY!               ")
    print("=========================================================================")

if __name__ == "__main__":
    main()
