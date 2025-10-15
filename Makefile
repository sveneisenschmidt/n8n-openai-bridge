.PHONY: help build rebuild start stop restart clean logs test test-unit test-image test-all verify version release-check release-prepare release-tag

# Get version from VERSION file
VERSION := $(shell cat VERSION 2>/dev/null || echo "0.0.0")

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
	@echo "  make test           - Run all tests (unit + image build)"
	@echo "  make test-unit      - Run unit tests for server logic only"
	@echo "  make test-image     - Run Docker image build validation tests"
	@echo "  make test-all       - Alias for test"
	@echo ""
	@echo "Release:"
	@echo "  make version        - Show current version from VERSION file"
	@echo "  make release-check  - Check if ready for release"
	@echo "  make release-prepare NEW_VERSION=x.y.z - Prepare new release"
	@echo "  make release-tag    - Create git tag for current version"

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
	@DOCKER_BUILDKIT=1 docker build -f Dockerfile.test -t n8n-openai-bridge-test .
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

# Release Management

version:
	@echo "Current version: $(VERSION)"
	@echo ""
	@echo "This version is read from the VERSION file."
	@echo "To update, run: make release-prepare NEW_VERSION=x.y.z"

release-check:
	@echo "Checking release readiness..."
	@echo ""
	@echo "Current version: $(VERSION)"
	@echo ""
	@if [ -z "$(VERSION)" ] || [ "$(VERSION)" = "0.0.0" ]; then \
		echo "✗ VERSION file not found or invalid"; \
		exit 1; \
	fi
	@echo "✓ VERSION file exists: $(VERSION)"
	@echo ""
	@if ! git diff-index --quiet HEAD --; then \
		echo "✗ Uncommitted changes detected"; \
		echo "  Please commit all changes before release"; \
		exit 1; \
	fi
	@echo "✓ No uncommitted changes"
	@echo ""
	@if ! git diff --quiet HEAD origin/main 2>/dev/null; then \
		echo "⚠ Local branch differs from origin/main"; \
		echo "  Consider pushing changes first"; \
	else \
		echo "✓ Branch in sync with origin/main"; \
	fi
	@echo ""
	@if git tag | grep -q "^v$(VERSION)$$"; then \
		echo "✗ Tag v$(VERSION) already exists"; \
		exit 1; \
	fi
	@echo "✓ Tag v$(VERSION) does not exist yet"
	@echo ""
	@if ! grep -q "## \[$(VERSION)\]" CHANGELOG.md; then \
		echo "⚠ Version $(VERSION) not found in CHANGELOG.md"; \
		echo "  Consider updating CHANGELOG.md"; \
	else \
		echo "✓ Version $(VERSION) documented in CHANGELOG.md"; \
	fi
	@echo ""
	@echo "Ready for release!"

release-prepare:
	@if [ -z "$(NEW_VERSION)" ]; then \
		echo "Error: NEW_VERSION not specified"; \
		echo "Usage: make release-prepare NEW_VERSION=0.0.4"; \
		exit 1; \
	fi
	@echo "Preparing release $(NEW_VERSION)..."
	@echo ""
	@echo "Current version: $(VERSION)"
	@echo "New version: $(NEW_VERSION)"
	@echo ""
	@read -p "Continue? [y/N] " -n 1 -r; \
	echo; \
	if [[ ! $$REPLY =~ ^[Yy]$$ ]]; then \
		echo "Aborted."; \
		exit 1; \
	fi
	@echo "$(NEW_VERSION)" > VERSION
	@echo "✓ Updated VERSION file to $(NEW_VERSION)"
	@echo ""
	@echo "Next steps:"
	@echo "1. Update CHANGELOG.md with version $(NEW_VERSION) and changes"
	@echo "2. Run: git add VERSION CHANGELOG.md"
	@echo "3. Run: git commit -m 'Prepare release v$(NEW_VERSION)'"
	@echo "4. Run: git push origin main"
	@echo "5. Run: make release-tag"
	@echo ""
	@echo "Or open CHANGELOG.md now? [y/N]"
	@read -p "" -n 1 -r; \
	if [[ $$REPLY =~ ^[Yy]$$ ]]; then \
		$${EDITOR:-nano} CHANGELOG.md; \
	fi

release-tag:
	@echo "Creating release tag for version $(VERSION)..."
	@echo ""
	@make release-check
	@echo ""
	@echo "This will:"
	@echo "  1. Create git tag: v$(VERSION)"
	@echo "  2. Push tag to origin"
	@echo "  3. Trigger GitHub Actions to build and publish Docker images"
	@echo ""
	@read -p "Continue? [y/N] " -n 1 -r; \
	echo; \
	if [[ ! $$REPLY =~ ^[Yy]$$ ]]; then \
		echo "Aborted."; \
		exit 1; \
	fi
	@git tag -a "v$(VERSION)" -m "Release v$(VERSION)"
	@echo "✓ Created tag v$(VERSION)"
	@git push origin "v$(VERSION)"
	@echo "✓ Pushed tag to origin"
	@echo ""
	@echo "Tag created successfully!"
	@echo ""
	@echo "Next step: Create GitHub Release"
	@echo "  Run: gh release create v$(VERSION) --title 'Version $(VERSION)' --notes-file CHANGELOG.md"
	@echo "  Or visit: https://github.com/sveneisenschmidt/n8n-openai-bridge/releases/new?tag=v$(VERSION)"
