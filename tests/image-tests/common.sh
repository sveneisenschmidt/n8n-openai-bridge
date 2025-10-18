#!/bin/bash

# Common functions for Docker image tests

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Default values
IMAGE_NAME="${IMAGE_NAME:-n8n-openai-bridge:test-build}"
TEST_CONTAINER="${TEST_CONTAINER:-test-bridge-$$}"
PROJECT_ROOT="${PROJECT_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"

# Print functions
print_success() {
    echo -e "  ${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "  ${RED}✗${NC} $1"
}

print_warning() {
    echo -e "  ${YELLOW}⚠${NC} $1"
}

print_info() {
    echo "  $1"
}

# Cleanup function
cleanup_container() {
    docker rm -f "$TEST_CONTAINER" 2>/dev/null || true
}

cleanup_image() {
    docker rmi "$IMAGE_NAME" 2>/dev/null || true
}

cleanup_all() {
    cleanup_container
    cleanup_image
}

# Wait for container to be ready
wait_for_container_ready() {
    local max_wait=${1:-30}
    local waited=0
    
    while [ $waited -lt $max_wait ]; do
        LOGS=$(docker logs "$TEST_CONTAINER" 2>&1)
        
        if echo "$LOGS" | grep -q "Server running on port"; then
            return 0
        fi
        
        if echo "$LOGS" | grep -qi "Error loading models"; then
            echo "Container failed to initialize"
            echo "$LOGS"
            return 1
        fi
        
        sleep 1
        waited=$((waited + 1))
    done
    
    echo "Container failed to start within ${max_wait}s"
    docker logs "$TEST_CONTAINER"
    return 1
}

# Build image if not exists
ensure_image_built() {
    if ! docker image inspect "$IMAGE_NAME" > /dev/null 2>&1; then
        echo "Building image $IMAGE_NAME..."
        docker build -f docker/Dockerfile.build -t "$IMAGE_NAME" "$PROJECT_ROOT" > /dev/null 2>&1
        return $?
    fi
    return 0
}

export IMAGE_NAME TEST_CONTAINER PROJECT_ROOT
