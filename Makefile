.PHONY: dev dev-backend dev-frontend dev-engine dev-down build rebuild seed test test-backend test-frontend test-engine lint lint-frontend lint-backend lint-engine typecheck typecheck-frontend typecheck-engine

dev:
	docker compose up

dev-backend:
	docker compose up postgres web-backend

dev-frontend:
	docker compose up frontend

dev-engine:
	docker compose up quiz-engine

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

test: test-backend test-frontend test-engine

test-backend:
	cd services/web-backend && pnpm test

test-frontend:
	cd services/frontend && pnpm test

test-engine:
	cd services/quiz-engine && .venv/bin/python -m pytest -v

lint: lint-frontend lint-backend lint-engine

lint-frontend:
	cd services/frontend && pnpm lint

lint-backend:
	cd services/web-backend && pnpm lint

lint-engine:
	cd services/quiz-engine && ruff check src/ tests/

typecheck: typecheck-frontend typecheck-engine

typecheck-frontend:
	cd services/frontend && pnpm typecheck

typecheck-engine:
	cd services/quiz-engine && mypy src/
