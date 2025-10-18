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
if docker build -f docker/Dockerfile.build -t "$IMAGE_NAME" .; then
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
    LOGS=$(docker logs "$TEST_CONTAINER" 2>&1)

    # Check for successful startup
    if echo "$LOGS" | grep -q "Server running on port"; then
        echo "✓ Container started successfully"
        break
    fi

    # Check for ModelLoader initialization errors
    if echo "$LOGS" | grep -qi "Error loading models"; then
        echo "✗ ModelLoader failed to initialize"
        echo "Container logs:"
        echo "$LOGS"
        exit 1
    fi

    if [ $WAITED -eq $((MAX_WAIT - 1)) ]; then
        echo "✗ Container failed to start within ${MAX_WAIT}s"
        echo "Container logs:"
        echo "$LOGS"
        exit 1
    fi

    sleep 1
    WAITED=$((WAITED + 1))
done
echo ""

# Test 7: Health check endpoint
echo "Test 7: Testing health check endpoint..."
# Use docker exec to avoid network issues
if docker exec "$TEST_CONTAINER" wget -q -O- http://localhost:3333/health > /dev/null 2>&1; then
    HEALTH_RESPONSE=$(docker exec "$TEST_CONTAINER" wget -q -O- http://localhost:3333/health)

    # Verify health response structure
    if echo "$HEALTH_RESPONSE" | grep -q '"status"'; then
        echo "✓ Health check endpoint responding with valid structure"
    else
        echo "✗ Health check response has invalid structure"
        echo "Response: $HEALTH_RESPONSE"
        exit 1
    fi
else
    echo "✗ Health check endpoint not responding"
    echo "Container logs:"
    docker logs "$TEST_CONTAINER"
    exit 1
fi
echo ""

# Test 8: Check that models endpoint works and returns valid data
echo "Test 8: Verifying models endpoint and ModelLoader functionality..."
# Use docker exec with wget for consistency
MODELS_OUTPUT=$(docker exec "$TEST_CONTAINER" wget -q -O- --header="Authorization: Bearer test-token" http://localhost:3333/v1/models)

# Check if models endpoint returns valid JSON structure
if echo "$MODELS_OUTPUT" | grep -q '"object":"list"'; then
    echo "  ✓ Models endpoint returns valid OpenAI-compatible structure"
else
    echo "  ✗ Models endpoint has invalid structure"
    echo "  Response:"
    echo "  $MODELS_OUTPUT"
    exit 1
fi

# Check that at least the docker-default-model from models.json is loaded
if echo "$MODELS_OUTPUT" | grep -q "docker-default-model"; then
    echo "  ✓ ModelLoader successfully loaded models from models.json"
else
    echo "  ✗ ModelLoader failed to load expected models"
    echo "  Response:"
    echo "  $MODELS_OUTPUT"
    echo "  Container logs:"
    docker logs "$TEST_CONTAINER"
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
DEV_DEPS=$(docker run --rm "$IMAGE_NAME" sh -c 'cd /app && npm list --depth=0 2>/dev/null | grep -E "(jest|nodemon|supertest|eslint|prettier)" | grep -v "UNMET" || true')
if [ -z "$DEV_DEPS" ]; then
    echo "✓ No dev dependencies installed (production-only)"
else
    echo "✗ Dev dependencies found in production image:"
    echo "$DEV_DEPS"
    exit 1
fi
echo ""

# Test 11: Custom models.json can be mounted and ModelLoader reloads it
echo "Test 11: Testing custom models.json mount and ModelLoader flexibility..."
docker stop "$TEST_CONTAINER" > /dev/null 2>&1 || true
docker rm "$TEST_CONTAINER" > /dev/null 2>&1 || true

# Create temporary custom models.json with valid model format
TEMP_MODELS=$(mktemp) || { echo "✗ Failed to create temp file"; exit 1; }
cat > "$TEMP_MODELS" << 'EOF'
{
  "custom-test-model": "https://n8n.example.com/webhook/test/chat",
  "another-custom-model": "https://n8n.example.com/webhook/another/chat"
}
EOF

echo "  Testing ModelLoader with custom models.json..."
docker run -d --name "$TEST_CONTAINER" \
    -e BEARER_TOKEN=test-token \
    -v "$TEMP_MODELS:/app/models.json:ro" \
    "$IMAGE_NAME" > /dev/null

# Wait for container to be ready with custom models
MAX_WAIT=10
WAITED=0
MODELS_LOADED=false
while [ $WAITED -lt $MAX_WAIT ]; do
    if docker exec "$TEST_CONTAINER" wget -q -O- --header="Authorization: Bearer test-token" http://localhost:3333/v1/models 2>/dev/null | grep -q "custom-test-model"; then
        MODELS_LOADED=true
        break
    fi
    sleep 1
    WAITED=$((WAITED + 1))
done

if [ "$MODELS_LOADED" = false ]; then
    echo "  ✗ ModelLoader failed to load custom models.json within ${MAX_WAIT}s"
    echo "  Container logs:"
    docker logs "$TEST_CONTAINER"
    rm "$TEMP_MODELS"
    exit 1
fi

# Verify both custom models are loaded
CUSTOM_MODELS_OUTPUT=$(docker exec "$TEST_CONTAINER" wget -q -O- --header="Authorization: Bearer test-token" http://localhost:3333/v1/models)

if echo "$CUSTOM_MODELS_OUTPUT" | grep -q "custom-test-model" && echo "$CUSTOM_MODELS_OUTPUT" | grep -q "another-custom-model"; then
    echo "  ✓ ModelLoader successfully loaded custom models.json"
else
    echo "  ✗ ModelLoader did not load all custom models"
    echo "  Response:"
    echo "  $CUSTOM_MODELS_OUTPUT"
    rm "$TEMP_MODELS"
    exit 1
fi

# Verify that default docker-default-model is NOT present (replaced by custom)
if echo "$CUSTOM_MODELS_OUTPUT" | grep -q "docker-default-model"; then
    echo "  ✗ Default model still present (custom models.json should replace it)"
    rm "$TEMP_MODELS"
    exit 1
else
    echo "  ✓ Custom models.json correctly replaced default models"
fi

rm "$TEMP_MODELS"
echo ""

# Test 12: Invalid models.json should prevent startup (ModelLoader validation)
echo "Test 12: Testing ModelLoader validation with invalid models.json..."
docker stop "$TEST_CONTAINER" > /dev/null 2>&1 || true
docker rm "$TEST_CONTAINER" > /dev/null 2>&1 || true

# Create temporary invalid models.json (array instead of object)
TEMP_INVALID_MODELS=$(mktemp) || { echo "✗ Failed to create temp file"; exit 1; }
cat > "$TEMP_INVALID_MODELS" << 'EOF'
[
  "invalid-model-format"
]
EOF

echo "  Testing ModelLoader validation with invalid format..."
docker run -d --name "$TEST_CONTAINER" \
    -e BEARER_TOKEN=test-token \
    -v "$TEMP_INVALID_MODELS:/app/models.json:ro" \
    "$IMAGE_NAME" > /dev/null 2>&1

# Wait and check if container logs show validation error
sleep 2
VALIDATION_LOGS=$(docker logs "$TEST_CONTAINER" 2>&1)

if echo "$VALIDATION_LOGS" | grep -qi "Models must be an object"; then
    echo "  ✓ ModelLoader correctly validates models.json format"
else
    echo "  ✗ ModelLoader did not catch invalid models.json format"
    echo "  Container logs:"
    echo "  $VALIDATION_LOGS"
    rm "$TEMP_INVALID_MODELS"
    exit 1
fi

# Container should still start (with empty models) but log the error
if echo "$VALIDATION_LOGS" | grep -q "Server running on port"; then
    echo "  ✓ Server gracefully handles invalid models.json"
else
    echo "  ⚠ Warning: Server may not have started after model loading error"
fi

docker stop "$TEST_CONTAINER" > /dev/null 2>&1 || true
docker rm "$TEST_CONTAINER" > /dev/null 2>&1 || true
rm "$TEMP_INVALID_MODELS"
echo ""

# Test 13: Invalid model URL should be caught by ModelLoader validation
echo "Test 13: Testing ModelLoader URL validation..."
TEMP_INVALID_URL=$(mktemp) || { echo "✗ Failed to create temp file"; exit 1; }
cat > "$TEMP_INVALID_URL" << 'EOF'
{
  "invalid-url-model": "not-a-valid-url"
}
EOF

docker run -d --name "$TEST_CONTAINER" \
    -e BEARER_TOKEN=test-token \
    -v "$TEMP_INVALID_URL:/app/models.json:ro" \
    "$IMAGE_NAME" > /dev/null 2>&1

sleep 2
URL_VALIDATION_LOGS=$(docker logs "$TEST_CONTAINER" 2>&1)

if echo "$URL_VALIDATION_LOGS" | grep -qi "Invalid URL"; then
    echo "  ✓ ModelLoader correctly validates model URLs"
else
    echo "  ✗ ModelLoader did not catch invalid model URL"
    echo "  Container logs:"
    echo "  $URL_VALIDATION_LOGS"
    rm "$TEMP_INVALID_URL"
    exit 1
fi

docker stop "$TEST_CONTAINER" > /dev/null 2>&1 || true
docker rm "$TEST_CONTAINER" > /dev/null 2>&1 || true
rm "$TEMP_INVALID_URL"
echo ""

echo "======================================"
echo "✓ All Docker image build tests passed!"
echo "======================================"
