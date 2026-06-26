# KalaVaras — Developer Makefile
#
# Usage:
#   make setup      — Install all dependencies
#   make infra      — Start PostgreSQL + Redis + slit-scan via Docker
#   make dev        — Start Node.js API + Vite frontend (requires infra running)
#   make migrate    — Run Drizzle DB migrations
#   make build      — Production build (API + web)
#   make test       — Run all tests
#   make typecheck  — Run tsc --noEmit on both packages
#   make audit      — Run npm audit
#   make clean      — Remove build artifacts and node_modules
#   make stop       — Stop Docker services

.PHONY: setup infra dev migrate build test typecheck audit clean stop logs

# ── Setup ─────────────────────────────────────────────────────────────────────
setup:
	@echo "📦 Installing all dependencies..."
	npm install
	@echo "✅ Dependencies installed"

# ── Infrastructure ────────────────────────────────────────────────────────────
infra:
	@echo "🐳 Starting infrastructure services..."
	docker compose up -d --build
	@echo "⏳ Waiting for services to be healthy..."
	@sleep 5
	@docker compose ps
	@echo "✅ Infrastructure running"
	@echo "   PostgreSQL → localhost:5432"
	@echo "   Redis      → localhost:6379"
	@echo "   Slit-scan  → localhost:5000"

stop:
	@echo "🛑 Stopping infrastructure..."
	docker compose down
	@echo "✅ Services stopped"

logs:
	docker compose logs -f

# ── Development ───────────────────────────────────────────────────────────────
dev: 
	@echo "🚀 Starting development servers..."
	npm run dev

# ── Database ──────────────────────────────────────────────────────────────────
migrate:
	@echo "🗄️  Running database migrations..."
	cd apps/api && npx drizzle-kit migrate
	@echo "✅ Migrations complete"

db-studio:
	@echo "🗄️  Opening Drizzle Studio..."
	cd apps/api && npx drizzle-kit studio

# ── Build ─────────────────────────────────────────────────────────────────────
build:
	@echo "🔨 Building for production..."
	cd apps/api && npm run build
	cd apps/web && npm run build
	@echo "✅ Build complete"

# ── Test ──────────────────────────────────────────────────────────────────────
test:
	@echo "🧪 Running tests..."
	cd apps/api && npm test
	@echo "✅ Tests complete"

# ── Type check ────────────────────────────────────────────────────────────────
typecheck:
	@echo "🔍 Type checking..."
	cd apps/api && npx tsc --noEmit
	cd apps/web && npx tsc --noEmit
	@echo "✅ No type errors"

# ── Security ──────────────────────────────────────────────────────────────────
audit:
	@echo "🔐 Running security audit..."
	npm audit --audit-level=high
	@echo "✅ Audit complete"

# ── Clean ─────────────────────────────────────────────────────────────────────
clean:
	@echo "🧹 Cleaning build artifacts..."
	rm -rf apps/api/dist apps/web/dist
	rm -rf apps/api/node_modules apps/web/node_modules node_modules
	@echo "✅ Clean complete"
