#!/bin/sh
set -e

echo "[entrypoint] Waiting for dependencies..."
# Wait a bit for postgres to be ready (healthcheck should handle, but be defensive)
sleep 5

echo "[entrypoint] Running prisma migrate deploy..."
if [ -n "$DATABASE_URL" ]; then
  npx prisma migrate deploy
else
  echo "[entrypoint] DATABASE_URL not set, skipping migrate deploy"
fi

if [ "$RUN_SEED" = "true" ]; then
  echo "[entrypoint] Running seed (RUN_SEED=true)..."
  npx tsx prisma/seed.ts || npm run seed || true
fi

echo "[entrypoint] Starting server..."
exec "$@"
