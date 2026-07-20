# ── Stage 1: build frontend ──────────────────────────────────────────
FROM node:24-slim AS frontend-builder

WORKDIR /app/frontend
COPY services/frontend/package.json services/frontend/pnpm-lock.yaml services/frontend/.npmrc ./
RUN npm install -g pnpm@11.15.0 && pnpm install --ignore-scripts
COPY services/frontend/ .
RUN pnpm run build

# ── Stage 2: build backend ──────────────────────────────────────────
FROM node:24-slim AS backend-builder

RUN npm install -g pnpm@11.15.0

WORKDIR /app
COPY services/web-backend/package.json services/web-backend/pnpm-lock.yaml services/web-backend/.npmrc services/web-backend/pnpm-workspace.yaml ./
COPY services/web-backend/prisma ./prisma
COPY services/web-backend/prisma.config.ts ./

RUN pnpm install && pnpm prisma generate

COPY services/web-backend/ .
RUN pnpm build

# ── Stage 3: runtime ────────────────────────────────────────────────
FROM node:24-slim

RUN npm install -g pnpm@11.15.0 && apt-get update && apt-get install -y --no-install-recommends curl ca-certificates && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy Prisma generated client + migrations from builder
COPY --from=backend-builder /app/prisma/generated ./prisma/generated
COPY --from=backend-builder /app/prisma/migrations ./prisma/migrations
COPY --from=backend-builder /app/prisma/schema.prisma ./prisma/
COPY --from=backend-builder /app/prisma.config.ts ./
COPY --from=backend-builder /app/package.json ./
COPY --from=backend-builder /app/pnpm-lock.yaml ./
COPY --from=backend-builder /app/pnpm-workspace.yaml ./

RUN pnpm install --prod

# Copy compiled backend
COPY --from=backend-builder /app/dist ./dist

# Copy built frontend
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Copy docker entrypoint
COPY services/web-backend/docker-entrypoint.prod.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

EXPOSE 3000

HEALTHCHECK --interval=10s --timeout=5s --retries=3 --start-period=15s \
  CMD curl -f http://localhost:3000/health || exit 1

CMD ["sh", "/app/docker-entrypoint.sh"]
