#!/bin/bash

echo "=== MedCore KG Backend Starting ==="

# Step 1: Try alembic migrations
echo "Running alembic upgrade head..."
alembic upgrade head 2>&1 || {
    echo "Alembic failed — falling back to SQLAlchemy create_all..."
    python -c "
from app.core.database import engine
from app.models import *
from app.models.base import Base
import asyncio

async def create():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print('Tables created via create_all')

asyncio.run(create())
" 2>&1 || echo "create_all also failed, continuing anyway..."

    # Stamp alembic to head so future migrations work
    alembic stamp head 2>&1 || true
}

# Step 2: Run seeds
echo "Running seed scripts..."
python seed_prod_all.py 2>&1 || true
python seed_catalogs.py 2>&1 || true

# Step 3: Start server
echo "Starting uvicorn on port ${PORT:-8000}..."
exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
