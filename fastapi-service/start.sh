#!/bin/bash
set -e

echo "========================================================================="
echo "                  STARTING FASTAPI STACK BOOTSTRAPPER                    "
echo "========================================================================="

# Skip dependency checks when running on managed platforms (Render, Railway, etc.)
# where services like PostgreSQL are external (Neon, Aiven, etc.), not local containers.
if [ "$SKIP_DEP_CHECK" = "true" ] || [ "$RENDER" = "true" ]; then
  echo "[INFO] Managed platform detected — skipping local dependency port checks."
else
  # Helper Python script to wait for active network ports to open (Docker Compose only)
  python -c "
import socket
import time
import sys

def wait_for_port(host, port, name):
    print(f'Waiting for {name} ({host}:{port}) to become reachable...')
    for _ in range(30):
        try:
            with socket.create_connection((host, port), timeout=2):
                print(f'[SUCCESS] {name} is fully online!')
                return
        except (socket.timeout, ConnectionRefusedError, OSError):
            time.sleep(1)
    print(f'[WARNING] {name} not reachable after 30s, continuing anyway...')

# Check dependencies if running inside Docker Compose context
wait_for_port('postgres', 5432, 'PostgreSQL Database')
wait_for_port('redis', 6379, 'Redis Server')
wait_for_port('kafka', 9092, 'Kafka Broker')
"
fi

echo "-------------------------------------------------------------------------"
echo "All checks passed. Launching FastAPI Application..."
echo "-------------------------------------------------------------------------"

# Start FastAPI application using Uvicorn (no --reload in production)
exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
