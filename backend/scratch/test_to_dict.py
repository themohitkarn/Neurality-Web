import os
os.environ["FLASK_APP"] = "app.py"

from app import create_app
from extensions import db
from models.user import User
import traceback

app = create_app()
with app.app_context():
    try:
        user = User.query.first()
        if user:
            print(f"Testing to_dict for user {user.id}")
            data = user.to_dict(viewer_id=user.id, include_email=True, include_settings=True)
            print("Success!")
        else:
            print("No users in DB")
    except Exception as e:
        print("ERROR IN to_dict:")
        traceback.print_exc()
