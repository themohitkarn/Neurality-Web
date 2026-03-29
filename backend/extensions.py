from flask_bcrypt import Bcrypt
from flask_cors import CORS
from flask_socketio import SocketIO
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()
bcrypt = Bcrypt()
cors = CORS()
socketio = SocketIO(async_mode="threading")
