import logging

from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy import inspect, text

from extensions import db


USER_COLUMN_MIGRATIONS = [
    ("full_name", "ALTER TABLE users ADD COLUMN full_name VARCHAR(120)"),
    ("website", "ALTER TABLE users ADD COLUMN website VARCHAR(255)"),
    ("location", "ALTER TABLE users ADD COLUMN location VARCHAR(120)"),
    ("theme_preference", "ALTER TABLE users ADD COLUMN theme_preference VARCHAR(20) NOT NULL DEFAULT 'system'"),
    ("is_private", "ALTER TABLE users ADD COLUMN is_private BOOLEAN NOT NULL DEFAULT 0"),
    ("account_type", "ALTER TABLE users ADD COLUMN account_type VARCHAR(20) NOT NULL DEFAULT 'personal'"),
    ("allow_message_requests", "ALTER TABLE users ADD COLUMN allow_message_requests BOOLEAN NOT NULL DEFAULT 1"),
    ("show_activity_status", "ALTER TABLE users ADD COLUMN show_activity_status BOOLEAN NOT NULL DEFAULT 1"),
    ("email_notifications", "ALTER TABLE users ADD COLUMN email_notifications BOOLEAN NOT NULL DEFAULT 1"),
    ("push_notifications", "ALTER TABLE users ADD COLUMN push_notifications BOOLEAN NOT NULL DEFAULT 1"),
    ("autoplay_reels", "ALTER TABLE users ADD COLUMN autoplay_reels BOOLEAN NOT NULL DEFAULT 1"),
    ("reduce_data_usage", "ALTER TABLE users ADD COLUMN reduce_data_usage BOOLEAN NOT NULL DEFAULT 0"),
]


logger = logging.getLogger(__name__)


def ensure_runtime_schema():
    inspector = inspect(db.engine)
    table_names = set(inspector.get_table_names())
    if "users" not in table_names:
        return

    existing_columns = {column["name"] for column in inspector.get_columns("users")}
    pending_statements = [statement for column, statement in USER_COLUMN_MIGRATIONS if column not in existing_columns]
    if not pending_statements:
        return

    try:
        with db.engine.begin() as connection:
            for statement in pending_statements:
                connection.execute(text(statement))
    except SQLAlchemyError as exc:
        logger.warning("Runtime schema migration skipped: %s", exc)
