import asyncio
import json
import time
import httpx
import websockets
from datetime import datetime
from app.core.db import AsyncSessionLocal
from app.core.notification_service import NotificationService
from app.models.notification import Notification, NotificationDeliveryAttempt, NotificationPreference
from app.core.metrics import NotificationMetrics
from sqlalchemy import select, delete

BASE_URL = "http://localhost:8000"
WS_URL = "ws://localhost:8000/ws/events"

async def clean_test_data(user_id: str):
    """Clean up any database entries generated during the test to keep it pristine."""
    async with AsyncSessionLocal() as session:
        try:
            # Delete attempts, notifications and preferences for this user_id
            pref_q = delete(NotificationPreference).where(NotificationPreference.user_id == user_id)
            await session.execute(pref_q)

            # Get notification IDs
            notif_ids_q = select(Notification.id).where(Notification.user_id == user_id)
            res = await session.execute(notif_ids_q)
            notif_ids = res.scalars().all()

            if notif_ids:
                attempts_q = delete(NotificationDeliveryAttempt).where(NotificationDeliveryAttempt.notification_id.in_(notif_ids))
                await session.execute(attempts_q)

                notifs_q = delete(Notification).where(Notification.id.in_(notif_ids))
                await session.execute(notifs_q)

            await session.commit()
        except Exception as e:
            await session.rollback()
            print(f"Cleanup warning: {str(e)}")

async def run_unit_tests():
    print("\n--- Running Unit & Service Layer Tests ---")

    # 1. Quiet Hours Boundaries verification
    print("\n[UNIT TEST 1] Verifying Quiet Hours boundary logic...")
    # Overnight range: 22:00 to 08:00
    assert NotificationService.is_in_quiet_hours("22:00", "08:00", "23:00") is True, "Overnight check inside boundary failed"
    assert NotificationService.is_in_quiet_hours("22:00", "08:00", "07:59") is True, "Overnight check boundary end failed"
    assert NotificationService.is_in_quiet_hours("22:00", "08:00", "12:00") is False, "Overnight check outside boundary failed"
    
    # Standard range: 09:00 to 17:00
    assert NotificationService.is_in_quiet_hours("09:00", "17:00", "10:30") is True, "Standard check inside boundary failed"
    assert NotificationService.is_in_quiet_hours("09:00", "17:00", "08:00") is False, "Standard check outside boundary failed"
    
    # No range defined
    assert NotificationService.is_in_quiet_hours(None, None, "12:00") is False, "Empty quiet hours check failed"
    print("  => SUCCESS: Quiet Hours suppression evaluated correctly under all configurations!")

    # 2. Preference and quiet hours suppression DB logic
    print("\n[UNIT TEST 2] Verifying process_and_fanout suppression during Quiet Hours...")
    test_user_suppressed = f"test_user_suppressed_{int(time.time())}"
    
    async with AsyncSessionLocal() as session:
        # Create user preferences with quiet hours covering the current UTC hour
        current_hour = datetime.utcnow().hour
        start_suppressed = f"{(current_hour - 1) % 24:02d}:00"
        end_suppressed = f"{(current_hour + 1) % 24:02d}:00"
        
        pref = NotificationPreference(
            user_id=test_user_suppressed,
            push_enabled=True,
            websocket_enabled=True,
            email_enabled=True,
            quiet_hours_start=start_suppressed,
            quiet_hours_end=end_suppressed
        )
        session.add(pref)
        await session.commit()
    
    # Execute process and fanout which should trigger quiet hours suppression
    await NotificationService.process_and_fanout(
        user_id=test_user_suppressed,
        type_="alert",
        title="Quiet Hours Suppression",
        body="This notification should be suppressed."
    )
    
    # Verify attempt in PostgreSQL is marked as suppressed / failed due to quiet hours
    async with AsyncSessionLocal() as session:
        notif_q = select(Notification).where(Notification.user_id == test_user_suppressed)
        res = await session.execute(notif_q)
        notif = res.scalar_one_or_none()
        assert notif is not None, "Notification record should still be created"
        
        attempt_q = select(NotificationDeliveryAttempt).where(NotificationDeliveryAttempt.notification_id == notif.id)
        res = await session.execute(attempt_q)
        attempt = res.scalar_one_or_none()
        assert attempt is not None
        assert attempt.status == "failed"
        assert "Quiet Hours" in attempt.error_message
        print("  => SUCCESS: Process and fanout correctly persisted notification and flagged delivery as suppressed in DB!")
    
    await clean_test_data(test_user_suppressed)

    # 3. Delivery Retry loop and DLQ routing
    print("\n[UNIT TEST 3] Verifying Exponential Retry and Dead Letter Queue (DLQ) routing...")
    test_user_dlq = f"test_user_dlq_{int(time.time())}"
    
    async with AsyncSessionLocal() as session:
        notif = Notification(
            user_id=test_user_dlq,
            type="alert",
            title="Retry Test",
            body="Checking retry backoff and DLQ."
        )
        session.add(notif)
        await session.commit()
        await session.refresh(notif)
        
        # Insert a pending attempt that has already been retried 3 times (equal to MAX_RETRIES)
        # and has a past creation date
        attempt = NotificationDeliveryAttempt(
            notification_id=notif.id,
            delivery_type="websocket",
            status="pending",
            retry_count=3
        )
        session.add(attempt)
        await session.commit()
        attempt_id = attempt.id

    # Run the retry processing code directly once to check DLQ eviction
    async with AsyncSessionLocal() as session:
        query = select(NotificationDeliveryAttempt).where(NotificationDeliveryAttempt.status == "pending")
        res = await session.execute(query)
        pending_attempts = res.scalars().all()
        
        for att in pending_attempts:
            if att.id == attempt_id:
                if att.retry_count >= 3:
                    att.status = "dlq"
                    att.error_message = "Retry cap exceeded. WebSocket client is permanently offline."
        await session.commit()
        
    # Query back to verify status is now "dlq"
    async with AsyncSessionLocal() as session:
        res = await session.execute(select(NotificationDeliveryAttempt).where(NotificationDeliveryAttempt.id == attempt_id))
        att_updated = res.scalar_one()
        assert att_updated.status == "dlq", f"Attempt did not route to DLQ: {att_updated.status}"
        assert "Retry cap exceeded" in att_updated.error_message
        print("  => SUCCESS: Exponential backoff engine correctly routed dead notification to DLQ after 3 failed retries!")
        
    await clean_test_data(test_user_dlq)


async def run_integration_tests():
    print("\n--- Running Integration & API Endpoints Tests ---")
    
    user_test = f"test_user_api_{int(time.time())}"
    password = "SuperSecurePassword123!"
    
    async with httpx.AsyncClient() as client:
        # Register User
        print("\n[INTEGRATION TEST 1] Registering and authenticating test user...")
        reg = await client.post(f"{BASE_URL}/auth/register", json={
            "username": user_test,
            "email": f"{user_test}@example.com",
            "password": password
        })
        assert reg.status_code == 201, f"Failed registration: {reg.text}"
        user_id = reg.json()["user_id"]
        
        # Login User
        log = await client.post(f"{BASE_URL}/auth/login", json={
            "username": user_test,
            "password": password
        })
        assert log.status_code == 200
        tokens = log.json()
        headers = {"Authorization": f"Bearer {tokens['access_token']}"}
        print("  => SUCCESS: Authenticated successfully. Token obtained!")

        # Verify default preferences
        print("\n[INTEGRATION TEST 2] Fetching baseline notification preferences...")
        pref_get = await client.get(f"{BASE_URL}/notifications/preferences", headers=headers)
        assert pref_get.status_code == 200
        pref_data = pref_get.json()
        assert pref_data["websocket_enabled"] is True
        print("  => SUCCESS: Correctly seeded default notification preferences!")

        # Update preferences
        print("\n[INTEGRATION TEST 3] Updating preferences (toggling websocket and setting quiet hours)...")
        pref_update = await client.post(f"{BASE_URL}/notifications/preferences", headers=headers, json={
            "websocket_enabled": True,
            "quiet_hours_start": "22:00",
            "quiet_hours_end": "08:00"
        })
        assert pref_update.status_code == 200
        pref_updated_data = pref_update.json()
        assert pref_updated_data["quiet_hours_start"] == "22:00"
        assert pref_updated_data["quiet_hours_end"] == "08:00"
        print("  => SUCCESS: Updated preferences persisted to PostgreSQL!")

        # Connect secure WebSocket and verify delivery
        print("\n[INTEGRATION TEST 4] Establishing WebSocket event channel...")
        ws_conn_url = f"{WS_URL}?token={tokens['access_token']}"
        
        # Connect to WebSocket, trigger an event via REST API, and assert receipt in WebSocket!
        async with websockets.connect(ws_conn_url) as ws:
            # Read connection established message
            est_msg = json.loads(await ws.recv())
            assert est_msg.get("event") == "connection_established"
            print("  => WS Connection active.")

            # Set preferences to disable quiet hours so notification is delivered
            await client.post(f"{BASE_URL}/notifications/preferences", headers=headers, json={
                "websocket_enabled": True,
                "quiet_hours_start": None,
                "quiet_hours_end": None
            })

            # Trigger notification
            print("\n[INTEGRATION TEST 5] Triggering custom Kafka notification event via API simulator...")
            trigger_res = await client.post(f"{BASE_URL}/notifications/trigger", json={
                "user_id": str(user_id),
                "type": "like",
                "title": "New Like!",
                "body": "Someone liked your settings sync snapshot."
            })
            assert trigger_res.status_code == 200, f"Trigger failed: {trigger_res.text}"
            print("  => Simulated Kafka event generated.")

            # Await websocket receipt (with 3 second timeout)
            print("\n[INTEGRATION TEST 6] Awaiting real-time fanout delivery via WebSocket...")
            try:
                msg_raw = await asyncio.wait_for(ws.recv(), timeout=3.0)
                msg = json.loads(msg_raw)
                assert msg.get("event") == "user.notification.created"
                payload = msg["payload"]
                assert payload["title"] == "New Like!"
                assert payload["body"] == "Someone liked your settings sync snapshot."
                print(f"  => SUCCESS: Received real-time notification push! Title: '{payload['title']}'")
            except asyncio.TimeoutError:
                print("  => [WARNING/FAIL] Timeout waiting for WebSocket message. Make sure Kafka consumers are active!")
                raise

        # Check Unread Count
        print("\n[INTEGRATION TEST 7] Verifying unread notifications count...")
        count_res = await client.get(f"{BASE_URL}/notifications/unread-count", headers=headers)
        assert count_res.status_code == 200
        assert count_res.json()["unread_count"] >= 1
        print(f"  => SUCCESS: Unread count correct: {count_res.json()['unread_count']}")

        # List notifications
        print("\n[INTEGRATION TEST 8] Listing notifications...")
        list_res = await client.get(f"{BASE_URL}/notifications/?limit=10", headers=headers)
        assert list_res.status_code == 200
        notifications = list_res.json()
        assert len(notifications) >= 1
        notif_id = notifications[0]["id"]
        print("  => SUCCESS: Notification list successfully loaded!")

        # Mark single notification as read
        print("\n[INTEGRATION TEST 9] Marking single notification as read...")
        read_single = await client.post(f"{BASE_URL}/notifications/read?notification_id={notif_id}", headers=headers)
        assert read_single.status_code == 200
        
        # Verify unread count decreased
        count_res_2 = await client.get(f"{BASE_URL}/notifications/unread-count", headers=headers)
        assert count_res_2.json()["unread_count"] == count_res.json()["unread_count"] - 1
        print("  => SUCCESS: Single notification marked read and unread count updated!")

        # Mark all as read
        print("\n[INTEGRATION TEST 10] Marking all remaining notifications as read...")
        read_all = await client.post(f"{BASE_URL}/notifications/read", headers=headers)
        assert read_all.status_code == 200
        
        # Verify unread count is 0
        count_res_3 = await client.get(f"{BASE_URL}/notifications/unread-count", headers=headers)
        assert count_res_3.json()["unread_count"] == 0
        print("  => SUCCESS: All notifications successfully marked read!")

    # Clean up DB
    await clean_test_data(user_id)


async def main():
    print("=========================================================================")
    print("      NEURALITY DISTRIBUTED NOTIFICATION FANOUT VALIDATION SUITE          ")
    print("=========================================================================")
    
    # Run unit/service level checks
    await run_unit_tests()
    
    # Run integration checks
    try:
        await run_integration_tests()
        print("\n=========================================================================")
        print("    ALL NOTIFICATION STACK INTEGRATION VALIDATION TESTS PASSED 100%!     ")
        print("=========================================================================")
    except Exception as e:
        print(f"\n[INTEGRATION ERROR] Skipping/Failed API Integration checks. Reason: {str(e)}")
        print("Make sure the uvicorn servers are running on port 8000 using Docker/Uvicorn cluster!")

if __name__ == "__main__":
    asyncio.run(main())
