import logging
from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from app.config import settings

logger = logging.getLogger("fastapi-app")

# Normalize DATABASE_URL to always use the asyncpg driver
_raw_url = settings.DATABASE_URL
if _raw_url.startswith("postgres://"):
    _raw_url = _raw_url.replace("postgres://", "postgresql+asyncpg://", 1)
elif _raw_url.startswith("postgresql://"):
    _raw_url = _raw_url.replace("postgresql://", "postgresql+asyncpg://", 1)
# If it already has +asyncpg, leave it as-is

# Initialize async engine and sessionmaker
engine = create_async_engine(
    _raw_url,
    echo=True if settings.ENVIRONMENT == "development" else False,
    future=True
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False
)

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Dependency helper to yield database sessions with auto-rollback on exception."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception as e:
            logger.error(f"Database session exception: {str(e)}")
            await session.rollback()
            raise
        finally:
            await session.close()
