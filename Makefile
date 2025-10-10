.PHONY: help build rebuild start stop restart clean logs test test-unit test-build test-rebuild test-clean verify

help:
	@echo "Available commands:"
	@echo "  make rebuild     - Stop containers, rebuild image, and start server"
	@echo "  make build       - Build the Docker image"
	@echo "  make start       - Start the server with docker compose"
	@echo "  make stop        - Stop running containers"
	@echo "  make restart     - Restart the containers"
	@echo "  make clean       - Stop and remove containers, images, and volumes"
	@echo "  make logs        - Show container logs"
	@echo "  make test        - Build and run unit tests (always uses latest code)"
	@echo "  make test-unit   - Alias for test"
	@echo "  make test-build  - Build test Docker image"
	@echo "  make test-rebuild- Clean and rebuild test Docker image"
	@echo "  make test-clean  - Remove test Docker image"
	@echo "  make verify      - Verify the running server responds correctly"

rebuild: stop build start
	@echo "Rebuild complete!"

build:
	@echo "Building Docker image with latest changes..."
	DOCKER_BUILDKIT=1 docker compose build 

start:
	@echo "Starting server..."
	docker compose up -d
	@echo "Server started successfully!"

stop:
	@echo "Stopping containers..."
	docker compose down || true

restart: stop start

clean:
	@echo "Cleaning up containers, images, and volumes..."
	docker compose down -v --rmi all || true

logs:
	docker compose logs -f

verify:
	@echo "Verifying models endpoint..."
	@if [ -z "$$(docker compose ps -q n8n-openai-bridge 2>/dev/null)" ]; then \
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

test:
	@echo "Building test image with latest changes..."
	@DOCKER_BUILDKIT=1 docker build -f Dockerfile.test -t n8n-openai-bridge-test .
	@echo "Running unit tests in Docker..."
	@docker run --rm n8n-openai-bridge-test
	@echo "✓ All tests passed!"

test-unit: test

test-build:
	@echo "Building test Docker image with cache..."
	@DOCKER_BUILDKIT=1 docker build -f Dockerfile.test -t n8n-openai-bridge-test .

test-rebuild: test-clean test-build
	@echo "✓ Test image rebuilt!"

test-clean:
	@echo "Cleaning up test Docker image..."
	docker rmi n8n-openai-bridge-test 2>/dev/null || true
	@echo "✓ Test image removed"
