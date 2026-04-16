"""Drop alembic_version table to reset migration state."""
import asyncio
from sqlalchemy import text
from app.core.database import engine

async def main():
    async with engine.connect() as conn:
        await conn.execute(text("DROP TABLE IF EXISTS alembic_version"))
        await conn.commit()
        print("alembic_version table dropped")

asyncio.run(main())
