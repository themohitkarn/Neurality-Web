FROM python:3.10-slim

WORKDIR /app

# Install system dependencies required for compiling extensions like confluent-kafka
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    librdkafka-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Expose port 8000
EXPOSE 8000

# Make startup scripts executable
RUN chmod +x start.sh

CMD ["./start.sh"]
