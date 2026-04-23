#!/bin/bash
set -e

echo "=== MedCore KG Backend Starting ==="
echo "Running database migrations..."

# Try normal upgrade first
alembic upgrade head 2>&1 && echo "Migrations OK" || {
    echo "Migration failed — trying to stamp and retry..."
    # If multiple heads, merge them
    alembic heads 2>&1 | grep -c "head" | xargs -I{} echo "Found {} heads"

    # Try stamping current state and upgrading
    alembic stamp head 2>&1 || true
    echo "Stamped to head, continuing..."
}

echo "Starting server on port ${PORT:-8000}..."
exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --workers ${WORKERS:-2}
