#!/bin/bash
set -e

echo "========================================================================="
echo "                  STARTING FASTAPI STACK BOOTSTRAPPER                    "
echo "========================================================================="

# Helper Python script to wait for active network ports to open
python -c "
import socket
import time
import sys

def wait_for_port(host, port, name):
    print(f'Waiting for {name} ({host}:{port}) to become reachable...')
    while True:
        try:
            with socket.create_connection((host, port), timeout=2):
                print(f'[SUCCESS] {name} is fully online!')
                break
        except (socket.timeout, ConnectionRefusedError):
            time.sleep(1)

# Check dependencies if running inside Docker context
wait_for_port('postgres', 5432, 'PostgreSQL Database')
wait_for_port('redis', 6379, 'Redis Server')
wait_for_port('kafka', 9092, 'Kafka Broker')
"

echo "-------------------------------------------------------------------------"
echo "All microservice dependencies are verified. Launching FastAPI Application..."
echo "-------------------------------------------------------------------------"

# Start FastAPI application using Uvicorn
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
