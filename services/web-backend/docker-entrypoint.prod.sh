#!/bin/sh
set -e

echo "Waiting for database..."
for i in $(seq 1 15); do
  if node -e "
    const net = require('net');
    const s = net.connect(5432, 'postgres', () => { s.end(); process.exit(0); });
    s.on('error', () => process.exit(1));
  " 2>/dev/null; then
    echo "Database ready!"
    break
  fi
  if [ "$i" -eq 15 ]; then
    echo "Database not available after 15 attempts, exiting."
    exit 1
  fi
  echo "Waiting... ($i/15)"
  sleep 2
done

echo "Running Prisma migrations..."
pnpm prisma migrate deploy

echo "Starting server..."
exec node dist/src/index.js
