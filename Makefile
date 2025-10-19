.PHONY: help build rebuild start stop restart clean logs test test-unit test-image test-all verify lint lint-fix format format-fix

help:
	@echo "Available commands:"
	@echo ""
	@echo "Development:"
	@echo "  make rebuild     - Stop containers, rebuild image, and start server"
	@echo "  make build       - Build the Docker image"
	@echo "  make start       - Start the server with docker compose"
	@echo "  make stop        - Stop running containers"
	@echo "  make restart     - Restart the containers"
	@echo "  make logs        - Show container logs"
	@echo "  make verify      - Verify the running server responds correctly"
	@echo "  make clean       - Stop and remove containers, images, and volumes"
	@echo ""
	@echo "Testing:"
	@echo "  make test              - Run all tests (unit + image build)"
	@echo "  make test-unit         - Run unit tests for server logic only"
	@echo "  make test-image        - Run Docker image build validation tests"
	@echo ""
	@echo "Code Quality:"
	@echo "  make lint              - Run ESLint to check code quality"
	@echo "  make lint-fix          - Run ESLint and auto-fix issues"
	@echo "  make format            - Check if code is formatted correctly"
	@echo "  make format-fix        - Format code with Prettier"

rebuild: stop build start
	@echo "Rebuild complete!"

build:
	@echo "Building Docker image with latest changes..."
	DOCKER_BUILDKIT=1 docker compose -f docker/docker-compose.dev.yml build

start:
	@echo "Starting server..."
	docker compose -f docker/docker-compose.dev.yml up -d
	@echo "Server started successfully!"

stop:
	@echo "Stopping containers..."
	docker compose -f docker/docker-compose.dev.yml down || true

restart: stop start

clean:
	@echo "Cleaning up containers, images, and volumes..."
	docker compose -f docker/docker-compose.dev.yml down -v --rmi all || true

logs:
	docker compose -f docker/docker-compose.dev.yml logs -f

verify:
	@echo "Verifying models endpoint..."
	@if [ -z "$$(docker compose -f docker/docker-compose.dev.yml ps -q n8n-openai-bridge 2>/dev/null)" ]; then \
		echo "✗ Error: Container is not running. Start it with 'make start'"; \
		exit 1; \
	fi
	@if [ ! -f .env ]; then \
		echo "✗ Error: .env file not found"; \
		exit 1; \
	fi
	@export $$(grep -v '^#' .env | xargs) && \
	PORT=$${PORT:-3333} && \
	if [ -z "$$BEARER_TOKEN" ]; then \
		curl -s http://localhost:$$PORT/v1/models && echo "\n✓ Models endpoint is responding (no auth)!"; \
	else \
		curl -s -H "Authorization: Bearer $$BEARER_TOKEN" http://localhost:$$PORT/v1/models && echo "\n✓ Models endpoint is responding!"; \
	fi || echo "✗ Error: Could not reach models endpoint"

# Test: Run all tests
test: test-unit test-image
	@echo ""
	@echo "======================================"
	@echo "✓ All tests passed successfully!"
	@echo "======================================"

test-all: test

# Test 1: Unit tests for server logic
test-unit:
	@echo "======================================"
	@echo "Running Unit Tests (Server Logic)"
	@echo "======================================"
	@echo ""
	@echo "Building test image with latest changes..."
	@DOCKER_BUILDKIT=1 docker build -f docker/Dockerfile.test -t n8n-openai-bridge-test .
	@echo ""
	@echo "Running unit tests in Docker..."
	@docker run --rm n8n-openai-bridge-test
	@echo ""
	@echo "✓ Unit tests passed!"

# Test 2: Docker image build validation (Bash - no external dependencies)
test-image:
	@echo ""
	@echo "======================================"
	@echo "Running Docker Image Tests"
	@echo "======================================"
	@echo ""
	@bash tests/test-image-build.sh



# Code Quality: Linting and Formatting
lint:
	@echo "Running ESLint..."
	@docker run --rm -v $(PWD):/app -w /app node:20-alpine sh -c "npm install --silent && npm run lint"

lint-fix:
	@echo "Running ESLint with auto-fix..."
	@docker run --rm -v $(PWD):/app -w /app node:20-alpine sh -c "npm install --silent && npm run lint:fix"

format:
	@echo "Checking code formatting..."
	@docker run --rm -v $(PWD):/app -w /app node:20-alpine sh -c "npm install --silent && npm run format:check"

format-fix:
	@echo "Formatting code with Prettier..."
	@docker run --rm -v $(PWD):/app -w /app node:20-alpine sh -c "npm install --silent && npm run format"
