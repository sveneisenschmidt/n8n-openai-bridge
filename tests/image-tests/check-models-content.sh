#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"

echo "Checking docker/models.json content in image..."

ensure_image_built || exit 1

MODELS_CONTENT=$(docker run --rm "$IMAGE_NAME" cat /app/models.json)

if echo "$MODELS_CONTENT" | grep -q "docker-default-model"; then
    print_success "docker/models.json contains expected placeholder model"
    exit 0
else
    print_error "docker/models.json does not contain expected model"
    echo "Content:"
    echo "$MODELS_CONTENT"
    exit 1
fi
