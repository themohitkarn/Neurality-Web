from flask_socketio import emit
from extensions import socketio

def handle_story_created(story_data):
    """Broadcast new story to all connected users."""
    # In a real app, you'd filter by followers, but for now we broadcast
    emit("story_update", {"type": "new_story", "story": story_data}, broadcast=True, namespace="/")

def init_story_sockets():
    @socketio.on("join_stories")
    def on_join(data):
        # Logic for joining story rooms if needed
        pass
