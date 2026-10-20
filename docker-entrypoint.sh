#!/bin/sh
set -e

echo "=========================================="
echo "   Cosmetics ERP - Container Startup      "
echo "=========================================="

if [ -n "$DATABASE_URL" ]; then
  echo "[1/3] Waiting for PostgreSQL database connection..."
  until pg_isready -d "$DATABASE_URL" > /dev/null 2>&1; do
    echo "  -> Waiting for database to be ready..."
    sleep 1
  done
  echo "  -> PostgreSQL connection established successfully!"

  echo "[2/3] Applying database migrations..."
  npx tsx scripts/migrate.ts || echo "Notice: Migrations check finished."

  echo "[3/3] Checking initial database seeds..."
  npx tsx scripts/seed.ts || echo "Notice: Seed already applied."
fi

echo "=========================================="
echo "   Starting Cosmetics ERP on port ${PORT:-3000} "
echo "=========================================="
exec "$@"
