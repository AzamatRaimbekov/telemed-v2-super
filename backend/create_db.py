"""Create the telemed database if it doesn't exist."""
import asyncio
import asyncpg
from app.core.config import settings

async def main():
    # Connect to default DB to create telemed
    conn = await asyncpg.connect(
        host=settings.POSTGRES_HOST,
        port=settings.POSTGRES_PORT,
        user=settings.POSTGRES_USER,
        password=settings.POSTGRES_PASSWORD,
        database="pathmind",
    )
    exists = await conn.fetchval("SELECT 1 FROM pg_database WHERE datname = $1", settings.POSTGRES_DB)
    if not exists:
        await conn.execute(f'CREATE DATABASE "{settings.POSTGRES_DB}"')
        print(f"Database '{settings.POSTGRES_DB}' created")
    else:
        print(f"Database '{settings.POSTGRES_DB}' already exists")
    await conn.close()

asyncio.run(main())
