import sys
import os

backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'backend'))
sys.path.insert(0, backend_path)

print("Starting script...")
import traceback

try:
    from app import create_app
    print("Creating app...")
    app = create_app()
    print("App created successfully!")
except Exception as e:
    print("FAILED TO CREATE APP:")
    traceback.print_exc()
