#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"

echo "Verifying models endpoint and ModelLoader functionality..."

ensure_image_built || exit 1
cleanup_container

# Start container
docker run -d --name "$TEST_CONTAINER" \
    -e BEARER_TOKEN=test-token \
    "$IMAGE_NAME" > /dev/null

if ! wait_for_container_ready 30; then
    print_error "Container failed to start"
    cleanup_container
    exit 1
fi

# Test models endpoint
MODELS_OUTPUT=$(docker exec "$TEST_CONTAINER" wget -q -O- --header="Authorization: Bearer test-token" http://localhost:3333/v1/models)

# Check OpenAI-compatible structure
if echo "$MODELS_OUTPUT" | grep -q '"object":"list"'; then
    print_success "Models endpoint returns valid OpenAI-compatible structure"
else
    print_error "Models endpoint has invalid structure"
    echo "Response: $MODELS_OUTPUT"
    cleanup_container
    exit 1
fi

# Check that docker-default-model is loaded
if echo "$MODELS_OUTPUT" | grep -q "docker-default-model"; then
    print_success "ModelLoader successfully loaded models from models.json"
else
    print_error "ModelLoader failed to load expected models"
    echo "Response: $MODELS_OUTPUT"
    cleanup_container
    exit 1
fi

cleanup_container
exit 0
