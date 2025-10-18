# Automated Assay Analysis - Backend Dockerfile
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY app.py .
COPY *.py .

# Create directory for uploads
RUN mkdir -p /app/uploads

# Set environment variables
ENV FLASK_APP=app.py
ENV FLASK_ENV=production
ENV PYTHONUNBUFFERED=1

# Railway provides PORT environment variable
# Use shell form to allow environment variable expansion
CMD gunicorn --bind 0.0.0.0:${PORT:-5000} --workers 4 --timeout 120 app:app
