import os
import sys

# Add backend directory to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

from app import create_app
from extensions import db
from sqlalchemy import text

app = create_app()

with app.app_context():
    print("--- Database Diagnostics ---")
    print("DATABASE_URL:", app.config.get("SQLALCHEMY_DATABASE_URI").split("@")[-1] if app.config.get("SQLALCHEMY_DATABASE_URI") else "None")
    
    # 1. Try to describe device_sessions table
    try:
        result = db.session.execute(text("""
            SELECT column_name, data_type, character_maximum_length 
            FROM information_schema.columns 
            WHERE table_name = 'device_sessions';
        """))
        columns = result.fetchall()
        if not columns:
            print("Table 'device_sessions' DOES NOT EXIST in the database!")
        else:
            print("Table 'device_sessions' columns in DB:")
            for col in columns:
                print(f" - {col[0]}: {col[1]} ({col[2]})")
    except Exception as exc:
        print("Failed to inspect schema:", exc)

    # 2. Try to run a test select
    try:
        db.session.execute(text("SELECT * FROM device_sessions LIMIT 1;"))
        print("SELECT * FROM device_sessions: Success!")
    except Exception as exc:
        print("SELECT failed with error:", exc)
