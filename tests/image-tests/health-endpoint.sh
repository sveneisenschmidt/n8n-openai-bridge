#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"

echo "Testing health check endpoint..."

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

# Test health endpoint
if docker exec "$TEST_CONTAINER" wget -q -O- http://localhost:3333/health > /dev/null 2>&1; then
    HEALTH_RESPONSE=$(docker exec "$TEST_CONTAINER" wget -q -O- http://localhost:3333/health)
    
    if echo "$HEALTH_RESPONSE" | grep -q '"status"'; then
        print_success "Health check endpoint responding with valid structure"
        cleanup_container
        exit 0
    else
        print_error "Health check response has invalid structure"
        echo "Response: $HEALTH_RESPONSE"
        cleanup_container
        exit 1
    fi
else
    print_error "Health check endpoint not responding"
    docker logs "$TEST_CONTAINER"
    cleanup_container
    exit 1
fi
