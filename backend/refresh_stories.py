from app import app
from extensions import db
from models.story import Story, StorySeen, StoryReaction

with app.app_context():
    print("Dropping and recreating story tables...")
    # Drop in order due to foreign keys
    StoryReaction.__table__.drop(db.engine, checkfirst=True)
    StorySeen.__table__.drop(db.engine, checkfirst=True)
    Story.__table__.drop(db.engine, checkfirst=True)
    
    # db.create_all()
    print("Prisma manages schema. Skipping create_all.")
    print("Done!")
