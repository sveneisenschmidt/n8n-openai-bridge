#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"

echo "Testing custom models.json mount and ModelLoader flexibility..."

ensure_image_built || exit 1
cleanup_container

# Create temporary custom models.json
TEMP_MODELS=$(mktemp) || {
    print_error "Failed to create temp file"
    exit 1
}

cat > "$TEMP_MODELS" << 'EOF'
{
  "custom-test-model": "https://n8n.example.com/webhook/test/chat",
  "another-custom-model": "https://n8n.example.com/webhook/another/chat"
}
EOF

print_info "Testing ModelLoader with custom models.json..."

docker run -d --name "$TEST_CONTAINER" \
    -e BEARER_TOKEN=test-token \
    -v "$TEMP_MODELS:/app/models.json:ro" \
    "$IMAGE_NAME" > /dev/null

# Wait for container
sleep 3

# Check if custom models are loaded
CUSTOM_MODELS_OUTPUT=$(docker exec "$TEST_CONTAINER" wget -q -O- --header="Authorization: Bearer test-token" http://localhost:3333/v1/models 2>/dev/null || echo "")

if echo "$CUSTOM_MODELS_OUTPUT" | grep -q "custom-test-model" && echo "$CUSTOM_MODELS_OUTPUT" | grep -q "another-custom-model"; then
    print_success "ModelLoader successfully loaded custom models.json"
else
    print_error "ModelLoader did not load all custom models"
    echo "Response: $CUSTOM_MODELS_OUTPUT"
    cleanup_container
    rm "$TEMP_MODELS"
    exit 1
fi

# Verify default model is NOT present
if echo "$CUSTOM_MODELS_OUTPUT" | grep -q "docker-default-model"; then
    print_error "Default model still present (custom models.json should replace it)"
    cleanup_container
    rm "$TEMP_MODELS"
    exit 1
else
    print_success "Custom models.json correctly replaced default models"
fi

cleanup_container
rm "$TEMP_MODELS"
exit 0
