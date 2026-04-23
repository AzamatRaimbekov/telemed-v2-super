#!/bin/bash
set -e
echo "Running migrations..."
cd /app && alembic upgrade head
echo "Starting seeds..."
python seed_prod_all.py || true
python seed_catalogs.py || true
python seed_exercises.py || true
echo "Starting server..."
exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --workers ${WORKERS:-2}
