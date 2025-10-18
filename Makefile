.PHONY: help build rebuild start stop restart clean logs test test-unit test-image test-all test-load test-load-discovery verify

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
	@echo "  make test                    - Run all tests (unit + image build)"
	@echo "  make test-unit               - Run unit tests for server logic only"
	@echo "  make test-image              - Run Docker image build validation tests"
	@echo "  make test-load               - Run all load tests (manual config + auto-discovery)"
	@echo "  make test-load-manual-config - Run load tests (manual models.json mode)"
	@echo "  make test-load-discovery     - Run load tests (auto-discovery mode)"

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
	@echo "OK All tests passed successfully!"
	@echo "======================================"

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

# Test 3: Load testing with k6 (via docker-compose) - All modes
test-load: test-load-manual-config test-load-discovery
	@echo ""
	@echo "======================================"
	@echo "All load tests completed!"
	@echo "======================================"

# Test 3a: Load testing - Manual models.json configuration
test-load-manual-config:
	@echo ""
	@echo "======================================"
	@echo "Running Load Tests (Manual Config)"
	@echo "20 users, 1min, models.json"
	@echo "======================================"
	@echo ""
	@echo "Building images..."
	@VUS=20 DURATION=1m AUTO_FETCH_MODELS_BY_TAG=false docker compose -f docker/docker-compose.loadtest.yml build
	@echo ""
	@echo "Starting services (mock-n8n, bridge, k6)..."
	@VUS=20 DURATION=1m AUTO_FETCH_MODELS_BY_TAG=false docker compose -f docker/docker-compose.loadtest.yml up --abort-on-container-exit --exit-code-from k6
	@echo ""
	@echo "Cleaning up..."
	@docker compose -f docker/docker-compose.loadtest.yml down -v
	@echo ""
	@echo "OK Load tests (Manual Config) completed!"
	@echo ""
	@if [ -f tests/load/summary.json ]; then \
		echo "Detailed results saved to: tests/load/summary.json"; \
	fi

# Test 3b: Load testing - Auto-Discovery mode
test-load-discovery:
	@echo ""
	@echo "======================================"
	@echo "Running Load Tests (Auto-Discovery)"
	@echo "20 users, 1min, auto-discovery mode"
	@echo "======================================"
	@echo ""
	@echo "Building images..."
	@VUS=20 DURATION=1m AUTO_FETCH_MODELS_BY_TAG=true N8N_API_BEARER_TOKEN=mock-token docker compose -f docker/docker-compose.loadtest.yml build
	@echo ""
	@echo "Starting services (mock-n8n, bridge, k6)..."
	@VUS=20 DURATION=1m AUTO_FETCH_MODELS_BY_TAG=true N8N_API_BEARER_TOKEN=mock-token docker compose -f docker/docker-compose.loadtest.yml up --abort-on-container-exit --exit-code-from k6
	@echo ""
	@echo "Cleaning up..."
	@docker compose -f docker/docker-compose.loadtest.yml down -v
	@echo ""
	@echo "OK Load tests (Auto-Discovery) completed!"
	@echo ""
	@if [ -f tests/load/summary.json ]; then \
		echo "Detailed results saved to: tests/load/summary.json"; \
	fi
