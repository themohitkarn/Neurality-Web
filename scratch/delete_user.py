import os
import sys

# Add backend directory to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

from app import create_app
from extensions import db
from models.user import User
from sqlalchemy import text

app = create_app()

with app.app_context():
    print("--- Searching for users to delete ---")
    
    # Search by username or email
    users_to_delete = User.query.filter(
        (User.username == "mohitkarn") | 
        (User.email.ilike("%mohitkarn%"))
    ).all()
    
    if not users_to_delete:
        print("No users found with username 'mohitkarn' or email matching 'mohitkarn'.")
        
        # Let's list some recent users in the system to help
        recent_users = User.query.order_by(User.id.desc()).limit(5).all()
        if recent_users:
            print("\nRecent users in database:")
            for u in recent_users:
                print(f" - ID: {u.id}, Username: {u.username}, Email: {u.email}")
    else:
        user_ids = [u.id for u in users_to_delete]
        user_emails = [u.email for u in users_to_delete if u.email]
        print(f"Found {len(users_to_delete)} user(s) to delete: IDs={user_ids}, Emails={user_emails}")
        
        # We will delete from related tables using raw SQL queries to bypass SQLAlchemy backref/constraint issues.
        # Wrap each table delete in a try-except to ensure the script proceeds smoothly even if some tables/columns don't exist.
        
        queries = [
            # 1. OTP Verifications
            ("otp_verifications", "DELETE FROM otp_verifications WHERE identifier IN :emails", {"emails": tuple(user_emails) if user_emails else ('',)}),
            
            # 2. Notifications (sender and receiver)
            ("notifications_receiver", "DELETE FROM notifications WHERE user_id IN :ids", {"ids": tuple(user_ids)}),
            ("notifications_sender", "DELETE FROM notifications WHERE sender_id IN :ids", {"ids": tuple(user_ids)}),
            
            # 3. Follow requests
            ("follow_requests_sender", "DELETE FROM follow_requests WHERE sender_id IN :ids", {"ids": tuple(user_ids)}),
            ("follow_requests_receiver", "DELETE FROM follow_requests WHERE receiver_id IN :ids", {"ids": tuple(user_ids)}),
            
            # 4. Message requests
            ("message_requests_sender", "DELETE FROM message_requests WHERE sender_id IN :ids", {"ids": tuple(user_ids)}),
            ("message_requests_receiver", "DELETE FROM message_requests WHERE receiver_id IN :ids", {"ids": tuple(user_ids)}),
            
            # 5. Device sessions
            ("device_sessions", "DELETE FROM device_sessions WHERE user_id IN :ids", {"ids": tuple(user_ids)}),
            
            # 6. Linked accounts
            ("linked_accounts", "DELETE FROM linked_accounts WHERE user_id IN :ids", {"ids": tuple(user_ids)}),
            
            # 7. Follows association table
            ("followers_follower", "DELETE FROM followers WHERE follower_id IN :ids", {"ids": tuple(user_ids)}),
            ("followers_followed", "DELETE FROM followers WHERE followed_id IN :ids", {"ids": tuple(user_ids)}),
            
            # 8. Post and Reel Likes
            ("post_likes", "DELETE FROM post_likes WHERE user_id IN :ids", {"ids": tuple(user_ids)}),
            ("reel_likes", "DELETE FROM reel_likes WHERE user_id IN :ids", {"ids": tuple(user_ids)}),
            
            # 9. Reel Views
            ("reel_views", "DELETE FROM reel_views WHERE user_id IN :ids", {"ids": tuple(user_ids)}),
            
            # 10. Comments
            ("comments", "DELETE FROM comments WHERE author_id IN :ids", {"ids": tuple(user_ids)}),
            
            # 11. Stories
            ("stories", "DELETE FROM stories WHERE author_id IN :ids", {"ids": tuple(user_ids)}),
            
            # 12. Reels
            ("reels", "DELETE FROM reels WHERE author_id IN :ids", {"ids": tuple(user_ids)}),
            
            # 13. Posts
            ("posts", "DELETE FROM posts WHERE author_id IN :ids", {"ids": tuple(user_ids)}),
            
            # 14. Primary Users Table
            ("users", "DELETE FROM users WHERE id IN :ids", {"ids": tuple(user_ids)})
        ]
        
        print("\nExecuting raw SQL deletes...")
        for name, query, params in queries:
            try:
                result = db.session.execute(text(query), params)
                print(f" - {name}: Deleted {result.rowcount} rows.")
            except Exception as e:
                db.session.rollback()
                # Print the error but keep going so we get to the core users table delete
                print(f" - {name} failed: {e}")
                
        try:
            db.session.commit()
            print("\nDatabase cleanup committed successfully!")
        except Exception as e:
            db.session.rollback()
            print("\nFailed to commit transaction:", e)
