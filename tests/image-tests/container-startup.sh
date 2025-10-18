#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"

echo "Testing container startup..."

ensure_image_built || exit 1
cleanup_container

# Start container
docker run -d --name "$TEST_CONTAINER" \
    -e BEARER_TOKEN=test-token \
    "$IMAGE_NAME" > /dev/null

print_info "Waiting for server to start..."
if wait_for_container_ready 30; then
    print_success "Container started successfully"
    cleanup_container
    exit 0
else
    print_error "Container failed to start"
    cleanup_container
    exit 1
fi
