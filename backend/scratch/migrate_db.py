import sys
import os

# Add backend to python path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app import create_app
from extensions import db
from sqlalchemy import text

app = create_app()

with app.app_context():
    print("Starting database schema migration...")
    
    # SQL queries to add the columns if they are missing
    migrations = [
        "ALTER TABLE reels ADD COLUMN IF NOT EXISTS duration FLOAT DEFAULT 15.0;",
        "ALTER TABLE reels ADD COLUMN IF NOT EXISTS tags VARCHAR(255)[] DEFAULT '{}';",
        "ALTER TABLE reels ADD COLUMN IF NOT EXISTS saves_count INTEGER DEFAULT 0;",
        "ALTER TABLE reels ADD COLUMN IF NOT EXISTS views_count INTEGER DEFAULT 0;"
    ]
    
    for query in migrations:
        try:
            print(f"Executing: {query}")
            db.session.execute(text(query))
            db.session.commit()
            print(" -> Success!")
        except Exception as e:
            db.session.rollback()
            print(f" -> Failed/Skipped: {e}")
            
    print("Migration finished!")
