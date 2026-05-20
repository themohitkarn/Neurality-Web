#!/bin/sh
set -e

echo "Starting FastAPI Service in Production Mode..."
exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
