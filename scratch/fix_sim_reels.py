import sys
import os
from pathlib import Path

# Add backend to python path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../backend")))

from app import create_app
from extensions import db
from models.reel import Reel

WORKING_MOCK_VIDEOS = [
    "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
    "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
    "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4",
    "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4",
    "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4",
    "https://res.cloudinary.com/demo/video/upload/dog.mp4",
    "https://res.cloudinary.com/demo/video/upload/elephants.mp4"
]

WORKING_MOCK_THUMBS = [
    "https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=500&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1589656966895-2f33e7653819?w=500&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=500&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=500&auto=format&fit=crop"
]

def fix_reels():
    app = create_app()
    with app.app_context():
        reels = Reel.query.all()
        print(f"Total reels found in database: {len(reels)}")
        
        modified_count = 0
        for i, reel in enumerate(reels):
            is_sim = False
            # Check if video_path contains 'sim_video_' or 'sim_reel_' or matches 404 patterns
            if "sim_video_" in reel.video_path or "sim_reel_" in reel.video_path or "demo/video/upload/sim" in reel.video_path:
                is_sim = True
            
            if is_sim:
                old_video = reel.video_path
                new_video = WORKING_MOCK_VIDEOS[i % len(WORKING_MOCK_VIDEOS)]
                reel.video_path = new_video
                
                # Also replace thumbnail if it uses sim_thumb_
                if "sim_thumb_" in reel.thumbnail_path or "demo/image/upload/sim" in reel.thumbnail_path:
                    reel.thumbnail_path = WORKING_MOCK_THUMBS[i % len(WORKING_MOCK_THUMBS)]
                
                print(f"Updating Reel ID {reel.id}: '{old_video}' -> '{new_video}'")
                modified_count += 1
                
        if modified_count > 0:
            db.session.commit()
            print(f"Successfully fixed {modified_count} reels in the database!")
        else:
            print("No reels required fixing.")

if __name__ == "__main__":
    fix_reels()
