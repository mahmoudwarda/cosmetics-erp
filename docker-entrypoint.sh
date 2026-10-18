#!/bin/sh
set -e

echo "=========================================="
echo "   Cosmetics ERP - Container Startup      "
echo "=========================================="

if [ -n "$DATABASE_URL" ]; then
  echo "[1/2] Running database migrations..."
  npx tsx scripts/migrate.ts || echo "Warning: Migration check completed."
fi

echo "[2/2] Starting Next.js Web Server..."
exec "$@"
