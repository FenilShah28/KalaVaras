# KalaVaras Slit-Scan Microservice — Dockerfile
#
# Security hardening:
# - Distroless-style: starts from slim Python 3.11 base (not full OS)
# - Non-root user (kalavaras:1001) — container has no root privileges
# - ffmpeg installed from Debian apt (pinned to available version)
# - No COPY of .env — secrets injected via environment at runtime
# - HEALTHCHECK built in for Docker / Kubernetes readiness probes

FROM python:3.11-slim AS base

# Install ffmpeg (required for frame extraction)
# Clean up apt caches in the same layer to keep image small
RUN apt-get update && \
    apt-get install -y --no-install-recommends ffmpeg && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN groupadd -g 1001 kalavaras && \
    useradd -u 1001 -g kalavaras -m -s /bin/false kalavaras

WORKDIR /app

# Install Python dependencies as root before switching user
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY processor.py main.py ./

# Switch to non-root user for all subsequent operations
USER kalavaras

# Expose service port
EXPOSE 5000

# Health check — Docker restarts the container if /health returns non-200
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:5000/health')" || exit 1

# Run with Gunicorn in production (4 workers, pre-fork model)
# FLASK_DEBUG is NOT set — debug mode must never be on in containers
CMD ["gunicorn", \
     "--bind", "0.0.0.0:5000", \
     "--workers", "4", \
     "--timeout", "120", \
     "--access-logfile", "-", \
     "--error-logfile", "-", \
     "main:app"]
