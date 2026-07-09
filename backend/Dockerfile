# BLACKBOX_AI Backend Docker Image
# Multi-stage build for ROCm + Python environment

# Stage 1: Base image with ROCm support
FROM rocm/pytorch:latest as base

# Set working directory
WORKDIR /app

# Install system dependencies for ROCm monitoring
RUN apt-get update && apt-get install -y --no-install-recommends \
    rocm-smi \
    rocprof \
    procps \
    iproute2 \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user for security
RUN useradd -m blackbox && chown -R blackbox:blackbox /app
USER blackbox

# Stage 2: Copy and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY backend/ .
COPY .env .env

# Expose WebSocket port
EXPOSE 8765

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import requests; requests.get('http://localhost:8765/health', timeout=5)" || exit 1

# Run the telemetry collector
CMD ["python", "websocket_server.py"]

# Alternative: Run with uvicorn for production
# CMD ["uvicorn", "websocket_server:app", "--host", "0.0.0.0", "--port", "8765"]
