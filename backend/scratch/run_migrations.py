import sys
import os

# Add backend to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app
from extensions import db
from utils.runtime_migrations import ensure_runtime_schema

app = create_app()
with app.app_context():
    print("Starting migrations...")
    try:
        ensure_runtime_schema()
        print("Migrations finished check logs or database.")
    except Exception as e:
        print(f"Migration failed: {e}")
