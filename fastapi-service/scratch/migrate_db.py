import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

async def main():
    # Connect using the configured asyncpg database URL
    db_url = "postgresql+asyncpg://postgres:postgres@localhost:5432/fastapi_db"
    print(f"Connecting to database at {db_url}...")
    engine = create_async_engine(db_url)
    
    async with engine.begin() as conn:
        print("Checking/Adding version column to user_settings table...")
        await conn.execute(text("ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1 NOT NULL;"))
        print("Schema update completed successfully!")

if __name__ == "__main__":
    asyncio.run(main())
