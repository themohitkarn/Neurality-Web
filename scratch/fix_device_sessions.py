import os
import sys

# Add backend directory to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

from app import create_app
from extensions import db
from sqlalchemy import text

app = create_app()

with app.app_context():
    print("Starting database migration...")
    try:
        # Drop the old mismatched table
        print("Dropping old 'device_sessions' table...")
        db.session.execute(text("DROP TABLE IF EXISTS device_sessions CASCADE;"))
        db.session.commit()
        print("Successfully dropped old 'device_sessions' table.")
        
        # Create all tables (this will recreate device_sessions with the correct schema)
        print("Recreating 'device_sessions' table with the correct schema...")
        db.create_all()
        db.session.commit()
        print("Successfully recreated 'device_sessions' table!")
        
        # Double check schema columns
        result = db.session.execute(text("""
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'device_sessions';
        """))
        print("\nNew columns in DB for 'device_sessions':")
        for col in result.fetchall():
            print(f" - {col[0]}: {col[1]}")
            
    except Exception as exc:
        db.session.rollback()
        print("Migration failed with error:", exc)
