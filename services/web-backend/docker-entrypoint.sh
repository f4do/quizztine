#!/bin/sh
set -e

echo "Waiting for database..."
for i in $(seq 1 30); do
  if node -e "
    const net = require('net');
    const s = net.connect(5432, 'postgres', () => { s.end(); process.exit(0); });
    s.on('error', () => process.exit(1));
  " 2>/dev/null; then
    echo "Database ready!"
    break
  fi
  echo "Waiting... ($i/30)"
  sleep 2
done

echo "Running Prisma migrations..."
pnpm prisma db push --accept-data-loss 2>&1 || true

echo "Running seed..."
pnpm prisma db seed 2>&1 || true

echo "Starting dev server..."
exec pnpm dev
