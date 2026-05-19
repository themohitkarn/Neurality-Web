import sys
import os

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app import create_app
from extensions import db
from models.user import User
from models.reel import Reel
from models.reel_view import ReelView

app = create_app()

with app.app_context():
    user_count = User.query.count()
    reel_count = Reel.query.count()
    view_count = ReelView.query.count()
    print(f"Users: {user_count}")
    print(f"Reels: {reel_count}")
    print(f"ReelViews: {view_count}")
