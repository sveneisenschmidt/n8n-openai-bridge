#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"

echo "Testing ModelLoader validation with invalid models.json..."

ensure_image_built || exit 1
cleanup_container

# Create temporary invalid models.json (array instead of object)
TEMP_INVALID_MODELS=$(mktemp) || {
    print_error "Failed to create temp file"
    exit 1
}

cat > "$TEMP_INVALID_MODELS" << 'EOF'
[
  "invalid-model-format"
]
EOF

print_info "Testing ModelLoader validation with invalid format..."

docker run -d --name "$TEST_CONTAINER" \
    -e BEARER_TOKEN=test-token \
    -v "$TEMP_INVALID_MODELS:/app/models.json:ro" \
    "$IMAGE_NAME" > /dev/null 2>&1

sleep 2
VALIDATION_LOGS=$(docker logs "$TEST_CONTAINER" 2>&1)

if echo "$VALIDATION_LOGS" | grep -qi "Models must be an object"; then
    print_success "ModelLoader correctly validates models.json format"
else
    print_error "ModelLoader did not catch invalid models.json format"
    echo "Container logs:"
    echo "$VALIDATION_LOGS"
    cleanup_container
    rm "$TEMP_INVALID_MODELS"
    exit 1
fi

# Container should still start despite invalid models
if echo "$VALIDATION_LOGS" | grep -q "Server running on port"; then
    print_success "Server gracefully handles invalid models.json"
else
    print_warning "Server may not have started after model loading error"
fi

cleanup_container
rm "$TEMP_INVALID_MODELS"
exit 0
