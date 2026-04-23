#!/bin/bash
set -e

echo "=========================================="
echo "  Railway Setup: telemed-v2"
echo "=========================================="

cd /Users/azamat/Desktop/telemed-v2-super

# Link to the new project
railway link c597ff60-9dd5-4515-afb7-0a69551bfdb8
echo "=> Linked to project telemed-v2"

# 1. Add PostgreSQL
echo ""
echo "=> Adding PostgreSQL..."
railway add --database postgres
echo "=> PostgreSQL added"

# 2. Add Redis
echo ""
echo "=> Adding Redis..."
railway add --database redis
echo "=> Redis added"

# 3. Create Backend service
echo ""
echo "=> Creating Backend service..."
railway add --service "backend"
echo "=> Backend service created"

# 4. Link and deploy Backend
echo ""
echo "=> Deploying Backend..."
railway service backend
railway variables --set "APP_ENV=production" \
  --set "PYTHONPATH=/app" \
  --set "PYTHONDONTWRITEBYTECODE=1" \
  --set "PYTHONUNBUFFERED=1"
cd backend
railway up --detach
cd ..
echo "=> Backend deployment started"

# 5. Create Frontend service
echo ""
echo "=> Creating Frontend service..."
railway add --service "frontend"
echo "=> Frontend service created"

# 6. Link and deploy Frontend
echo ""
echo "=> Deploying Frontend..."
railway service frontend
cd frontend
railway up --detach
cd ..
echo "=> Frontend deployment started"

echo ""
echo "=========================================="
echo "  DONE! Check Railway dashboard:"
echo "  railway open"
echo "=========================================="
echo ""
echo "After deploy completes, run:"
echo "  railway service backend"
echo "  railway domain"
echo "  railway service frontend"
echo "  railway domain"
echo ""
echo "Then set these env vars on Backend service:"
echo "  POSTGRES_HOST, POSTGRES_PORT, POSTGRES_DB,"
echo "  POSTGRES_USER, POSTGRES_PASSWORD"
echo "  (use railway variables from the postgres service)"
echo "  REDIS_URL (from redis service)"
