FROM python:3.12-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends build-essential && rm -rf /var/lib/apt/lists/*
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
ENV PYTHONPATH=/app
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
# Build: force redeploy v2
EXPOSE 8000
CMD ["sh", "-c", "alembic upgrade head 2>&1 || true && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
