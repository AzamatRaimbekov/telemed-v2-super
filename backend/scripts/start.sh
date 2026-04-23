#!/bin/bash

echo "=== MedCore KG Backend Starting ==="

# Step 1: Fix missing columns/tables directly via SQL
echo "Ensuring schema is up to date..."
python -c "
import asyncio
from app.core.database import engine
from app.models.base import Base
# Import ALL models to register them
from app.models import *

async def fix_schema():
    async with engine.begin() as conn:
        # Add missing columns that cause 500 errors
        fixes = [
            'ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_chat_id VARCHAR',
        ]
        for sql in fixes:
            try:
                await conn.execute(__import__('sqlalchemy').text(sql))
                print(f'OK: {sql[:60]}')
            except Exception as e:
                print(f'Skip: {str(e)[:80]}')

        # Create any missing tables
        await conn.run_sync(Base.metadata.create_all)
        print('create_all completed')

asyncio.run(fix_schema())
" 2>&1

# Step 2: Stamp alembic
echo "Stamping alembic..."
alembic stamp head 2>&1 || true

# Step 3: Run seeds
echo "Running seeds..."
python seed_prod_all.py 2>&1 || true
python seed_catalogs.py 2>&1 || true

# Step 4: Start server
echo "Starting uvicorn on port ${PORT:-8000}..."
exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
