#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"

echo "Testing ModelLoader URL validation..."

# Ensure image is built
ensure_image_built || exit 1

# Cleanup any existing container
cleanup_container

# Create temporary invalid models.json with invalid URL
TEMP_INVALID_URL=$(mktemp) || {
    print_error "Failed to create temp file"
    exit 1
}

cat > "$TEMP_INVALID_URL" << 'EOF'
{
  "invalid-url-model": "not-a-valid-url"
}
EOF

# Start container with invalid URL
docker run -d --name "$TEST_CONTAINER" \
    -e BEARER_TOKEN=test-token \
    -v "$TEMP_INVALID_URL:/app/models.json:ro" \
    "$IMAGE_NAME" > /dev/null 2>&1

sleep 2
URL_VALIDATION_LOGS=$(docker logs "$TEST_CONTAINER" 2>&1)

# Check if validation error is logged
if echo "$URL_VALIDATION_LOGS" | grep -qi "Invalid.*URL"; then
    print_success "ModelLoader correctly validates model URLs"

    # Verify server still starts despite invalid model
    if echo "$URL_VALIDATION_LOGS" | grep -q "Server running on port"; then
        print_success "Server gracefully handles invalid model URLs"
    else
        print_warning "Server may not have started after URL validation error"
    fi

    RESULT=0
else
    print_error "ModelLoader did not catch invalid model URL"
    echo "Container logs:"
    echo "$URL_VALIDATION_LOGS"
    RESULT=1
fi

# Cleanup
cleanup_container
rm "$TEMP_INVALID_URL"

exit $RESULT
