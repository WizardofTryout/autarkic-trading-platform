FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    git \
    && rm -rf /var/lib/apt/lists/*

# Install AI Frameworks
# RUN pip install metagpt
RUN pip install pyautogen

# Copy application code (placeholder)
# COPY . /app

# Keep container running for now
CMD ["tail", "-f", "/dev/null"]
