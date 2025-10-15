#!/bin/bash
set -e

# Test script for Docker image build validation
# This tests that the production Docker image builds correctly and contains expected files

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
IMAGE_NAME="n8n-openai-bridge:test-build"
TEST_CONTAINER="test-bridge-$$"

echo "======================================"
echo "Docker Image Build Test"
echo "======================================"
echo ""

# Cleanup function
cleanup() {
    echo ""
    echo "Cleaning up..."
    docker rm -f "$TEST_CONTAINER" 2>/dev/null || true
    docker rmi "$IMAGE_NAME" 2>/dev/null || true
    echo "✓ Cleanup complete"
}

trap cleanup EXIT

cd "$PROJECT_ROOT"

# Test 1: Build the image
echo "Test 1: Building production Docker image..."
if docker build -t "$IMAGE_NAME" .; then
    echo "✓ Docker image built successfully"
else
    echo "✗ Docker build failed"
    exit 1
fi
echo ""

# Test 2: Check image size (should be reasonably small)
echo "Test 2: Checking image size..."
IMAGE_SIZE=$(docker image inspect "$IMAGE_NAME" --format='{{.Size}}')
IMAGE_SIZE_MB=$((IMAGE_SIZE / 1024 / 1024))
echo "  Image size: ${IMAGE_SIZE_MB}MB"
if [ "$IMAGE_SIZE_MB" -lt 500 ]; then
    echo "✓ Image size is reasonable (< 500MB)"
else
    echo "⚠ Warning: Image size is larger than expected (${IMAGE_SIZE_MB}MB)"
fi
echo ""

# Test 3: Check that built-in config files exist in image
echo "Test 3: Verifying built-in configuration files..."
docker run --rm "$IMAGE_NAME" ls -la /app/.env /app/models.json > /dev/null
if [ $? -eq 0 ]; then
    echo "✓ Configuration files exist in image"
else
    echo "✗ Configuration files missing from image"
    exit 1
fi
echo ""

# Test 4: Check docker/.env content
echo "Test 4: Checking docker/.env content in image..."
ENV_CONTENT=$(docker run --rm "$IMAGE_NAME" cat /app/.env)
if echo "$ENV_CONTENT" | grep -q "BEARER_TOKEN=change-me"; then
    echo "✓ docker/.env contains expected default content"
else
    echo "✗ docker/.env does not contain expected content"
    echo "Content:"
    echo "$ENV_CONTENT"
    exit 1
fi
echo ""

# Test 5: Check docker/models.json content
echo "Test 5: Checking docker/models.json content in image..."
MODELS_CONTENT=$(docker run --rm "$IMAGE_NAME" cat /app/models.json)
if echo "$MODELS_CONTENT" | grep -q "docker-default-model"; then
    echo "✓ docker/models.json contains expected placeholder model"
else
    echo "✗ docker/models.json does not contain expected model"
    echo "Content:"
    echo "$MODELS_CONTENT"
    exit 1
fi
echo ""

# Test 6: Container starts successfully
echo "Test 6: Testing container startup..."
docker run -d --name "$TEST_CONTAINER" \
    -e BEARER_TOKEN=test-token \
    "$IMAGE_NAME" > /dev/null

# Wait for server to be ready by polling logs
echo "  Waiting for server to start..."
MAX_WAIT=30
WAITED=0
while [ $WAITED -lt $MAX_WAIT ]; do
    if docker logs "$TEST_CONTAINER" 2>&1 | grep -q "Server running on port"; then
        echo "✓ Container started successfully"
        break
    fi

    if [ $WAITED -eq $((MAX_WAIT - 1)) ]; then
        echo "✗ Container failed to start within ${MAX_WAIT}s"
        echo "Container logs:"
        docker logs "$TEST_CONTAINER"
        exit 1
    fi

    sleep 1
    WAITED=$((WAITED + 1))
done
echo ""

# Test 7: Health check endpoint
echo "Test 7: Testing health check endpoint..."
CONTAINER_IP=$(docker inspect -f '{{range.NetworkSettings.Networks}}{{.IPAddress}}{{end}}' "$TEST_CONTAINER")

if curl -sf "http://${CONTAINER_IP}:3333/health" > /dev/null 2>&1; then
    echo "✓ Health check endpoint responding"
else
    echo "✗ Health check endpoint not responding"
    echo "Container logs:"
    docker logs "$TEST_CONTAINER"
    exit 1
fi
echo ""

# Test 8: Check that docker-default-model is listed
echo "Test 8: Verifying built-in model is available..."
MODELS_OUTPUT=$(curl -sf -H "Authorization: Bearer test-token" "http://${CONTAINER_IP}:3333/v1/models")
if echo "$MODELS_OUTPUT" | grep -q "docker-default-model"; then
    echo "✓ Built-in docker-default-model is available via API"
else
    echo "✗ Built-in model not found in API response"
    echo "Response:"
    echo "$MODELS_OUTPUT"
    exit 1
fi
echo ""

# Test 9: Check that test files are NOT in production image
echo "Test 9: Verifying test files are excluded from production image..."
if docker run --rm "$IMAGE_NAME" ls /app/tests 2>/dev/null; then
    echo "✗ Test files found in production image (should be excluded)"
    exit 1
else
    echo "✓ Test files correctly excluded from production image"
fi
echo ""

# Test 10: Check Node.js production dependencies only
echo "Test 10: Checking installed dependencies..."
DEV_DEPS=$(docker run --rm "$IMAGE_NAME" sh -c 'cd /app && npm list --depth=0 2>/dev/null | grep -E "(jest|nodemon|supertest)" || true')
if [ -z "$DEV_DEPS" ]; then
    echo "✓ No dev dependencies installed (production-only)"
else
    echo "✗ Dev dependencies found in production image:"
    echo "$DEV_DEPS"
    exit 1
fi
echo ""

# Test 11: Custom models.json can be mounted
echo "Test 11: Testing custom models.json mount..."
docker stop "$TEST_CONTAINER" > /dev/null
docker rm "$TEST_CONTAINER" > /dev/null

# Create temporary custom models.json
TEMP_MODELS=$(mktemp)
cat > "$TEMP_MODELS" << 'EOF'
{
  "custom-test-model": "https://n8n.example.com/webhook/test/chat"
}
EOF

docker run -d --name "$TEST_CONTAINER" \
    -e BEARER_TOKEN=test-token \
    -v "$TEMP_MODELS:/app/models.json:ro" \
    "$IMAGE_NAME" > /dev/null

sleep 3

CONTAINER_IP=$(docker inspect -f '{{range.NetworkSettings.Networks}}{{.IPAddress}}{{end}}' "$TEST_CONTAINER")
CUSTOM_MODELS_OUTPUT=$(curl -sf -H "Authorization: Bearer test-token" "http://${CONTAINER_IP}:3333/v1/models")

if echo "$CUSTOM_MODELS_OUTPUT" | grep -q "custom-test-model"; then
    echo "✓ Custom models.json successfully mounted and loaded"
else
    echo "✗ Custom models.json not loaded"
    echo "Response:"
    echo "$CUSTOM_MODELS_OUTPUT"
    rm "$TEMP_MODELS"
    exit 1
fi

rm "$TEMP_MODELS"
echo ""

echo "======================================"
echo "✓ All Docker image build tests passed!"
echo "======================================"
