.PHONY: dev dev-server dev-client install build test lint seed migrate docker docker-down clean

# Development
dev:
	@echo "Starting both server and client..."
	@$(MAKE) dev-server &
	@$(MAKE) dev-client

dev-server:
	cd server && npm run dev

dev-client:
	cd client && npm run dev

# Install dependencies
install:
	cd server && npm install
	cd client && npm install

# Build
build:
	cd server && npm run build
	cd client && npm run build

# Test
test:
	cd server && npm test
	cd client && npm test

test-coverage:
	cd server && npm run test:coverage
	cd client && npm run test:coverage

# Lint
lint:
	cd client && npm run lint
	cd server && npm run lint 2>/dev/null || true

# Database
seed:
	cd server && npm run seed

migrate:
	cd server && npm run db:migrate

db-push:
	cd server && npm run db:push

init-stats:
	cd server && npm run init-stats

# Docker
docker:
	docker-compose up --build

docker-down:
	docker-compose down

docker-dev:
	docker-compose -f docker-compose.dev.yml up -d

# Clean
clean:
	rm -rf server/dist server/node_modules client/node_modules client/dist
