#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"

echo "Building production Docker image..."

cd "$PROJECT_ROOT"

if docker build -f docker/Dockerfile.build -t "$IMAGE_NAME" . > /dev/null 2>&1; then
    print_success "Docker image built successfully"
    exit 0
else
    print_error "Docker build failed"
    exit 1
fi
