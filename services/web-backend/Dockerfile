# Stage 1: Dependencies
FROM node:26-slim AS deps
RUN npm install -g pnpm@latest
WORKDIR /app
COPY package.json pnpm-lock.yaml .npmrc pnpm-workspace.yaml prisma.config.ts ./
COPY prisma ./prisma
RUN apt-get update && apt-get install -y --no-install-recommends python3 make gcc && rm -rf /var/lib/apt/lists/* && pnpm install && pnpm prisma generate

# Stage 2: Build
FROM deps AS build
COPY . .
RUN pnpm build

# Stage 3: Runtime
FROM node:26-slim AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends python3 make gcc && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/prisma.config.ts ./prisma.config.ts
COPY docker-entrypoint.prod.sh ./docker-entrypoint.sh
RUN chmod +x docker-entrypoint.sh
EXPOSE 3000
ENV NODE_ENV=production
CMD ["sh", "docker-entrypoint.sh"]
