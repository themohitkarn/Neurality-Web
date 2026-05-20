FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
    ffmpeg \
    libpq-dev \
    gcc \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
RUN pip install gunicorn

COPY . .

# Ensure static directories exist
RUN mkdir -p static/uploads/avatars static/uploads/posts static/uploads/stories static/videos/reels static/videos/thumbnails static/videos/tmp

EXPOSE 5000

CMD ["gunicorn", "--worker-class", "gthread", "--threads", "4", "-w", "1", "--bind", "0.0.0.0:5000", "app:app"]
