#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"

echo "Checking docker/.env content in image..."

ensure_image_built || exit 1

ENV_CONTENT=$(docker run --rm "$IMAGE_NAME" cat /app/.env)

if echo "$ENV_CONTENT" | grep -q "BEARER_TOKEN=change-me"; then
    print_success "docker/.env contains expected default content"
    exit 0
else
    print_error "docker/.env does not contain expected content"
    echo "Content:"
    echo "$ENV_CONTENT"
    exit 1
fi
