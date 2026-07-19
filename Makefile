.PHONY: dev dev-backend dev-frontend dev-down build rebuild seed test test-backend test-frontend lint lint-frontend lint-backend typecheck typecheck-frontend prod-build prod-up prod-down

dev:
	docker compose up

dev-backend:
	docker compose up postgres web-backend

dev-frontend:
	docker compose up frontend

dev-down:
	docker compose down -v

build:
	docker compose build

rebuild: build
	docker compose up -d --force-recreate

seed:
	docker compose exec web-backend pnpm prisma generate && \
	docker compose exec web-backend pnpm prisma db push && \
	docker compose exec web-backend pnpm tsx prisma/seed.ts

test: test-backend test-frontend

test-backend:
	cd services/web-backend && pnpm test

test-frontend:
	cd services/frontend && pnpm test

lint: lint-frontend lint-backend

lint-frontend:
	cd services/frontend && pnpm lint

lint-backend:
	cd services/web-backend && pnpm lint

typecheck: typecheck-frontend

typecheck-frontend:
	cd services/frontend && pnpm typecheck

prod-build:
	docker compose -f docker-compose.prod.yml build

prod-up:
	docker compose -f docker-compose.prod.yml up -d

prod-down:
	docker compose -f docker-compose.prod.yml down
