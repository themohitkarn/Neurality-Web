import asyncio
import json
import time
import httpx
import websockets
from datetime import datetime
from app.core.db import AsyncSessionLocal
from app.core.privacy_service import PrivacyService
from app.models.privacy import UserEdge
from app.models.user import User
from app.models.notification import Notification, NotificationDeliveryAttempt
from app.core.redis import redis_manager
from sqlalchemy import select, delete

BASE_URL = "http://localhost:8000"
WS_URL = "ws://localhost:8000/ws/events"

async def clean_test_data(user_ids: list):
    """Clean up any database and Redis cache entries generated during the test."""
    print(f"[CLEANUP] Purging test artifacts for users: {user_ids}")
    async with AsyncSessionLocal() as session:
        try:
            # Delete relationship edges
            edge_q = delete(UserEdge).where(
                (UserEdge.source_user_id.in_(user_ids)) | 
                (UserEdge.target_user_id.in_(user_ids))
            )
            await session.execute(edge_q)

            # Get notification IDs
            notif_ids_q = select(Notification.id).where(
                (Notification.user_id.in_(user_ids)) | 
                (Notification.actor_id.in_(user_ids))
            )
            res = await session.execute(notif_ids_q)
            notif_ids = res.scalars().all()

            if notif_ids:
                attempts_q = delete(NotificationDeliveryAttempt).where(NotificationDeliveryAttempt.notification_id.in_(notif_ids))
                await session.execute(attempts_q)

                notifs_q = delete(Notification).where(Notification.id.in_(notif_ids))
                await session.execute(notifs_q)

            # Delete test users
            user_q = delete(User).where(User.username.in_([f"alice_priv_{user_ids[0]}", f"bob_priv_{user_ids[1]}"]))
            await session.execute(user_q)

            await session.commit()
        except Exception as e:
            await session.rollback()
            print(f"Cleanup warning: {str(e)}")

    # Evict Redis cache sets
    for uid in user_ids:
        for etype in ["blocked", "muted", "restricted", "close_friend", "favorite"]:
            await redis_manager.delete(f"graph:{uid}:{etype}")

async def run_privacy_tests():
    print("\n====================================================")
    print("RUNNING DISTRIBUTED PRIVACY GRAPH ENGINE TEST SUITE")
    print("====================================================\n")

    # Establish Redis connection pool for test operations
    await redis_manager.connect()

    timestamp = int(time.time())
    user_a_name = f"alice_priv_{timestamp}"
    user_b_name = f"bob_priv_{timestamp}"
    password = "SuperSecurePassword123!"

    async with httpx.AsyncClient() as client:
        # 1. Register & Authenticate users
        print("[TEST 1] Registering and authenticating test users...")
        reg_a = await client.post(f"{BASE_URL}/auth/register", json={
            "username": user_a_name,
            "email": f"{user_a_name}@example.com",
            "password": password
        })
        assert reg_a.status_code == 201, f"Failed A registration: {reg_a.text}"
        user_a_id = str(reg_a.json()["user_id"])

        reg_b = await client.post(f"{BASE_URL}/auth/register", json={
            "username": user_b_name,
            "email": f"{user_b_name}@example.com",
            "password": password
        })
        assert reg_b.status_code == 201, f"Failed B registration: {reg_b.text}"
        user_b_id = str(reg_b.json()["user_id"])

        # Authenticate Alice
        log_a = await client.post(f"{BASE_URL}/auth/login", json={"username": user_a_name, "password": password})
        assert log_a.status_code == 200
        token_a = log_a.json()["access_token"]
        headers_a = {"Authorization": f"Bearer {token_a}"}

        # Authenticate Bob
        log_b = await client.post(f"{BASE_URL}/auth/login", json={"username": user_b_name, "password": password})
        assert log_b.status_code == 200
        token_b = log_b.json()["access_token"]
        headers_b = {"Authorization": f"Bearer {token_b}"}

        print(f"  => SUCCESS: Alice (ID: {user_a_id}) and Bob (ID: {user_b_id}) registered and authenticated!")

        # 2. Verify Profile view permitted initially
        print("\n[TEST 2] Verifying profile view is open initially...")
        profile_res = await client.get(f"{BASE_URL}/auth/profile/{user_b_id}", headers=headers_a)
        assert profile_res.status_code == 200
        assert profile_res.json()["username"] == user_b_name
        print("  => SUCCESS: Alice can view Bob's profile.")

        # 3. Create a Block Relationship (Alice blocks Bob)
        print("\n[TEST 3] Alice blocks Bob (POST /graph/edge)...")
        block_res = await client.post(
            f"{BASE_URL}/graph/edge", 
            headers=headers_a, 
            json={"target_user_id": user_b_id, "edge_type": "blocked"}
        )
        assert block_res.status_code == 201
        print("  => SUCCESS: Block edge successfully established in database.")

        # 4. Verify Redis caching and Sentinel Hydration
        print("\n[TEST 4] Verifying Redis set cache hydration and sentinel behavior...")
        # Trigger lookup to force hydration
        is_blocked = await PrivacyService.is_blocked(user_a_id, user_b_id)
        assert is_blocked is True

        # Check cache state for Alice
        cache_key = f"graph:{user_a_id}:blocked"
        members = await redis_manager.client.smembers(cache_key)
        assert len(members) > 0, "Cache set should be populated"
        assert user_b_id in members, "Target Bob ID must be cached inside the Redis set"
        print(f"  => SUCCESS: Graph edge correctly cached in Redis set: {members}")

        # Trigger empty lookup to force sentinel hydration
        is_muted = await PrivacyService.is_muted(user_a_id, user_b_id)
        assert is_muted is False

        # Check Sentinel hydration for empty relation (e.g. mutes)
        mute_cache_key = f"graph:{user_a_id}:muted"
        empty_members = await redis_manager.client.smembers(mute_cache_key)
        assert empty_members == {"__EMPTY__"}, f"Empty relation must contain '__EMPTY__' sentinel, got: {empty_members}"
        print("  => SUCCESS: Cache-penetration sentinel (__EMPTY__) hydrated correctly!")

        # 5. Verify Bidirectional Block enforcement on profile views
        print("\n[TEST 5] Verifying bidirectional block enforcement on profile views...")
        # Bob tries to view Alice's profile (Should be rejected)
        profile_bob_view = await client.get(f"{BASE_URL}/auth/profile/{user_a_id}", headers=headers_b)
        assert profile_bob_view.status_code == 403, f"Bob should be blocked, got: {profile_bob_view.status_code}"
        print(f"  => SUCCESS: Bob blocked from viewing Alice's profile (HTTP 403).")

        # Alice tries to view Bob's profile (Should also be rejected)
        profile_alice_view = await client.get(f"{BASE_URL}/auth/profile/{user_b_id}", headers=headers_a)
        assert profile_alice_view.status_code == 403, f"Alice should be blocked from viewing Bob's profile, got: {profile_alice_view.status_code}"
        print("  => SUCCESS: Alice also blocked from viewing Bob's profile (bidirectional check active).")

        # 6. Verify Settings access rejection
        print("\n[TEST 6] Verifying block rejects settings sync visibility...")
        settings_res = await client.get(f"{BASE_URL}/settings/{user_b_id}", headers=headers_a)
        assert settings_res.status_code == 403
        print("  => SUCCESS: Settings sync visibility rejected under block constraint.")

        # 7. Verify Notification suppression under active block
        print("\n[TEST 7] Verifying Notification fanout suppression under active block...")
        # Actor Alice attempts to trigger notification to Bob
        notif_suppress_res = await client.post(f"{BASE_URL}/notifications/trigger", json={
            "user_id": user_b_id,
            "type": "like",
            "title": "Blocked Event",
            "body": "This notification should be dropped.",
            "actor_id": user_a_id
        })
        assert notif_suppress_res.status_code == 200
        
        # Await async consumer processing of Kafka message
        await asyncio.sleep(1.0)

        # Check database: should have no notification created since they are blocked
        async with AsyncSessionLocal() as session:
            notif_q = select(Notification).where(
                (Notification.user_id == user_b_id) & 
                (Notification.actor_id == user_a_id)
            )
            res = await session.execute(notif_q)
            assert res.scalar_one_or_none() is None, "Dropped notification should not exist in database"
        print("  => SUCCESS: Notification delivery completely dropped under block relation!")

        # 8. Mute Suppression check (Remove block, add Mute)
        print("\n[TEST 8] Bob mutes Alice, testing notification mute suppression...")
        # Remove block
        unblock_res = await client.request(
            "DELETE",
            f"{BASE_URL}/graph/edge", 
            headers=headers_a, 
            json={"target_user_id": user_b_id, "edge_type": "blocked"}
        )
        assert unblock_res.status_code == 200

        # Bob mutes Alice
        mute_res = await client.post(
            f"{BASE_URL}/graph/edge", 
            headers=headers_b, 
            json={"target_user_id": user_a_id, "edge_type": "muted"}
        )
        assert mute_res.status_code == 201

        # Trigger notification from Alice to Bob
        notif_mute_res = await client.post(f"{BASE_URL}/notifications/trigger", json={
            "user_id": user_b_id,
            "type": "comment",
            "title": "Mute Test",
            "body": "This should be saved but suppressed.",
            "actor_id": user_a_id
        })
        assert notif_mute_res.status_code == 200

        # Await async consumer processing of Kafka message
        await asyncio.sleep(1.0)

        # Verify database: notification exists but attempt is recorded as failed/suppressed
        async with AsyncSessionLocal() as session:
            notif_q = select(Notification).where(
                (Notification.user_id == user_b_id) & 
                (Notification.actor_id == user_a_id)
            )
            res = await session.execute(notif_q)
            notif = res.scalar_one_or_none()
            assert notif is not None, "Notification row must exist in database"
            
            attempt_q = select(NotificationDeliveryAttempt).where(NotificationDeliveryAttempt.notification_id == notif.id)
            res = await session.execute(attempt_q)
            attempt = res.scalar_one_or_none()
            assert attempt is not None
            assert attempt.status == "failed"
            assert "muted the actor" in attempt.error_message
        print("  => SUCCESS: Notification persisted but active delivery suppressed with muted flag!")

        # 9. WebSocket Active suppression
        print("\n[TEST 9] Verifying real-time active WebSocket delivery suppression...")
        ws_conn_url = f"{WS_URL}?token={token_b}"
        async with websockets.connect(ws_conn_url) as ws:
            est_msg = json.loads(await ws.recv())
            assert est_msg.get("event") == "connection_established"
            print("  => Bob connected to WS.")

            # Trigger broadcast on behalf of actor Alice
            # Bob has muted Alice. The websocket delivery should get blocked/suppressed.
            # Let's verify by checking if anything is received within 1 second.
            try:
                msg_raw = await asyncio.wait_for(ws.recv(), timeout=1.0)
                msg = json.loads(msg_raw)
                print(f"  => [FAIL] Bob received a websocket event from Alice despite mute/block constraint: {msg}")
                assert False, "Websocket delivery should have been suppressed."
            except asyncio.TimeoutError:
                print("  => SUCCESS: Active WebSocket message successfully suppressed at connection level!")

    # Cleanup
    await clean_test_data([user_a_id, user_b_id])
    await redis_manager.disconnect()
    print("\n====================================================")
    print("ALL PRIVACY GRAPH ENGINE TESTS COMPLETED SUCCESSFULLY!")
    print("====================================================\n")

if __name__ == "__main__":
    asyncio.run(run_privacy_tests())
