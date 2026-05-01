#!/bin/bash

echo "=== MedCore KG Backend Starting ==="

# Step 1: Create/update all tables via SQLAlchemy metadata (idempotent, no alembic)
echo "Ensuring schema is up to date..."
python -c "
import asyncio
from app.core.database import engine
from app.models.base import Base
from app.models import *

async def fix_schema():
    async with engine.begin() as conn:
        fixes = [
            'ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_chat_id VARCHAR',
        ]
        for sql in fixes:
            try:
                await conn.execute(__import__('sqlalchemy').text(sql))
                print(f'OK: {sql[:60]}')
            except Exception as e:
                print(f'Skip: {str(e)[:80]}')
        await conn.run_sync(Base.metadata.create_all)
        print('create_all completed')

asyncio.run(fix_schema())
" 2>&1

# Step 2: Stamp alembic to current head (so future migrations work)
echo "Stamping alembic..."
alembic stamp head 2>&1 || true

# Step 3: Run seeds (all idempotent)
echo "Running seeds..."
seeds=(
    "seed_prod_all.py:Production data"
    "seed_catalogs.py:Catalogs"
    "seed_exercises.py:Exercises"
    "seed_rooms.py:Rooms & beds"
    "seed_rbac.py:RBAC permissions"
    "seed_monitoring.py:Monitoring"
    "seed_pharmacy.py:Pharmacy"
    "seed_bms.py:BMS"
)
for entry in "${seeds[@]}"; do
    script="${entry%%:*}"
    label="${entry##*:}"
    if [ -f "$script" ]; then
        timeout 120 python "$script" 2>&1 && echo "Seed [$label] OK" || echo "Seed [$label] warning"
    fi
done

# Step 4: Start server
echo "Starting uvicorn on port ${PORT:-8000}..."
exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
