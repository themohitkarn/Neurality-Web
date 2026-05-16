from app import create_app
from extensions import db
from sqlalchemy import text

app = create_app()

def fix_sequences():
    # List of tables with Int @id @default(autoincrement()) in Prisma
    tables = [
        'users', 
        'posts', 
        'reels', 
        'stories', 
        'comments', 
        'notifications',
        'message_requests',
        'follow_requests',
        'close_friends',
        'saved_posts',
        'pinned_posts',
        'story_highlights',
        'story_highlight_items',
        'story_reactions',
        'story_seen',
        'reports',
        'groups'
    ]
    
    with app.app_context():
        for table in tables:
            try:
                print(f"Fixing sequence for table: {table}")
                # Get the actual next value needed (MAX(id) or 1 if empty)
                # Then set the sequence to that value
                query = text(f"""
                    SELECT setval(
                        pg_get_serial_sequence('"{table}"', 'id'),
                        COALESCE((SELECT MAX(id) FROM "{table}"), 1)
                    );
                """)
                # Using double quotes for table names in case of reserved words or mixed case
                db.session.execute(query)
                db.session.commit()
                print(f"Successfully reset sequence for {table}")
            except Exception as e:
                print(f"Error fixing sequence for {table}: {e}")
                db.session.rollback()

if __name__ == "__main__":
    fix_sequences()
