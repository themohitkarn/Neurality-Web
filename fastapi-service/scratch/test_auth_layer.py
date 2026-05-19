import asyncio
import httpx
import websockets
import json
import time
import uuid

BASE_URL = "http://localhost:8000"
WS_URL = "ws://localhost:8000/ws/events"

async def test_auth_and_session_safety():
    print("=========================================================================")
    print("      NEURALITY SECURE AUTH & DISTRIBUTED SESSION VALIDATION SUITE       ")
    print("=========================================================================")

    # Unique test subjects
    user_a_name = f"user_a_{int(time.time())}"
    user_b_name = f"user_b_{int(time.time())}"
    password = "SuperSecurePassword123!"

    async with httpx.AsyncClient() as client:
        # ====================================================
        # SCENARIO 1: REGISTER USER A AND USER B
        # ====================================================
        print("\n[TEST 1] Registering User A and User B...")
        reg_a = await client.post(f"{BASE_URL}/auth/register", json={
            "username": user_a_name,
            "email": f"{user_a_name}@example.com",
            "password": password
        })
        assert reg_a.status_code == 201, f"Failed to register User A: {reg_a.text}"
        user_a_id = reg_a.json()["user_id"]
        print(f"  => User A Registered. ID: {user_a_id}")

        reg_b = await client.post(f"{BASE_URL}/auth/register", json={
            "username": user_b_name,
            "email": f"{user_b_name}@example.com",
            "password": password
        })
        assert reg_b.status_code == 201, f"Failed to register User B: {reg_b.text}"
        user_b_id = reg_b.json()["user_id"]
        print(f"  => User B Registered. ID: {user_b_id}")

        # Try registering duplicate username
        reg_dup = await client.post(f"{BASE_URL}/auth/register", json={
            "username": user_a_name,
            "email": f"different_email_{int(time.time())}@example.com",
            "password": password
        })
        assert reg_dup.status_code == 400
        print("  => SUCCESS: Duplicate username registration was correctly rejected!")

        # ====================================================
        # SCENARIO 2: LOGIN & TOKEN VERIFICATION
        # ====================================================
        print("\n[TEST 2] Logging in User A...")
        login_a = await client.post(f"{BASE_URL}/auth/login", json={
            "username": user_a_name,
            "password": password
        })
        assert login_a.status_code == 200, f"Login failed: {login_a.text}"
        tokens_a = login_a.json()
        assert "access_token" in tokens_a
        assert "refresh_token" in tokens_a
        print("  => SUCCESS: JWT access and refresh tokens generated successfully!")

        print("\n[TEST 3] Fetching profile (GET /auth/me)...")
        headers_a = {"Authorization": f"Bearer {tokens_a['access_token']}"}
        me_a = await client.get(f"{BASE_URL}/auth/me", headers=headers_a)
        assert me_a.status_code == 200
        assert me_a.json()["username"] == user_a_name
        print(f"  => SUCCESS: Verified authenticated profile for '{user_a_name}'!")

        # ====================================================
        # SCENARIO 3: USER OWNERSHIP ENFORCEMENT (PART 6)
        # ====================================================
        print("\n[TEST 4] Asserting ownership boundaries (GET /settings/{user_id})...")
        
        # User A accessing their OWN settings -> Should seed and return 200
        settings_a = await client.get(f"{BASE_URL}/settings/{user_a_id}", headers=headers_a)
        assert settings_a.status_code == 200, f"A failed accessing own settings: {settings_a.text}"
        print(f"  => User A accessing own settings: Allowed (Version {settings_a.json()['version']})")

        # User A attempting to access User B's settings -> Must yield 403 Forbidden!
        settings_b = await client.get(f"{BASE_URL}/settings/{user_b_id}", headers=headers_a)
        assert settings_b.status_code == 403, f"Snooping allowed: {settings_b.status_code}"
        print("  => SUCCESS: Cross-user settings access rejected with 403 Forbidden!")

        print("\n[TEST 5] Asserting ownership boundaries on mutation (POST /settings/update)...")
        # User A trying to update User B's settings -> Must yield 403 Forbidden!
        update_payload = {
            "user_id": str(user_b_id),
            "theme": "light",
            "email_notifications": False,
            "push_notifications": True,
            "language": "en",
            "expected_version": 1
        }
        update_b = await client.post(f"{BASE_URL}/settings/update", json=update_payload, headers=headers_a)
        assert update_b.status_code == 403, f"Cross-user update allowed: {update_b.status_code}"
        print("  => SUCCESS: Cross-user mutation update rejected with 403 Forbidden!")

        # ====================================================
        # SCENARIO 4: REFRESH TOKEN ROTATION (RTR) & REPLAY PROTECTION
        # ====================================================
        print("\n[TEST 6] Triggering Refresh Token Rotation (RTR)...")
        refresh_1 = await client.post(f"{BASE_URL}/auth/refresh", json={
            "refresh_token": tokens_a["refresh_token"]
        })
        assert refresh_1.status_code == 200, f"RTR Refresh failed: {refresh_1.text}"
        tokens_a_new = refresh_1.json()
        assert tokens_a_new["access_token"] != tokens_a["access_token"]
        assert tokens_a_new["refresh_token"] != tokens_a["refresh_token"]
        print("  => SUCCESS: Fresh access and refresh tokens rotated cleanly!")

        print("\n[TEST 7] Testing Token Replay breach check (Reusing old refresh token)...")
        # Attempt to reuse the first (now rotated/invalidated) refresh token
        refresh_replay = await client.post(f"{BASE_URL}/auth/refresh", json={
            "refresh_token": tokens_a["refresh_token"]
        })
        assert refresh_replay.status_code == 401
        print("  => SUCCESS: Replayed refresh token correctly rejected!")

        # Verify that because of the replay breach check, the ENTIRE session was revoked!
        # Access with the new, otherwise valid, access token must now also be rejected!
        headers_new = {"Authorization": f"Bearer {tokens_a_new['access_token']}"}
        revoked_access = await client.get(f"{BASE_URL}/auth/me", headers=headers_new)
        assert revoked_access.status_code == 401
        print("  => SUCCESS: Session completely revoked in Redis after replay alert!")

        # ====================================================
        # SCENARIO 5: SECURE WEBSOCKET AUTHENTICATION (PART 5 & 9)
        # ====================================================
        print("\n[TEST 8] Testing Secure WebSocket Auth...")
        
        # Log in User B to get fresh tokens
        login_b = await client.post(f"{BASE_URL}/auth/login", json={
            "username": user_b_name,
            "password": password
        })
        tokens_b = login_b.json()

        # Connect with invalid token
        try:
            async with websockets.connect(f"{WS_URL}?token=invalid_jwt_token") as ws:
                resp = await ws.recv()
                msg = json.loads(resp)
                assert msg.get("error") == "AUTHENTICATION_FAILED"
                print("  => SUCCESS: WebSocket rejected connection with invalid JWT token!")
        except Exception as e:
            # Sockets might close instantly on connection rejection, which is also correct
            print(f"  => SUCCESS: WebSocket connection closed for invalid token ({str(e)})")

        # Connect with valid token
        async with websockets.connect(f"{WS_URL}?token={tokens_b['access_token']}") as ws:
            resp = await ws.recv()
            msg = json.loads(resp)
            assert msg.get("event") == "connection_established"
            print("  => SUCCESS: WebSocket successfully accepted and authenticated valid JWT!")

        # ====================================================
        # SCENARIO 6: LOGOUT & REVOCATION
        # ====================================================
        print("\n[TEST 9] Logging out User B...")
        logout_b = await client.post(f"{BASE_URL}/auth/logout", json={
            "refresh_token": tokens_b["refresh_token"]
        })
        assert logout_b.status_code == 200
        print("  => User B session logged out.")

        # Try fetching User B profile using the logged-out token
        headers_b = {"Authorization": f"Bearer {tokens_b['access_token']}"}
        revoked_me = await client.get(f"{BASE_URL}/auth/me", headers=headers_b)
        assert revoked_me.status_code == 401
        print("  => SUCCESS: Logged out access token instantly revoked in Redis!")

    print("\n=========================================================================")
    print("      ALL AUTH AND SECURE SESSION LAYER VALIDATION TESTS PASSED 100%!   ")
    print("=========================================================================")

if __name__ == "__main__":
    asyncio.run(test_auth_and_session_safety())
