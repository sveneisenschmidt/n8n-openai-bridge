#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"

echo "Verifying built-in configuration files..."

ensure_image_built || exit 1

if docker run --rm "$IMAGE_NAME" ls -la /app/.env /app/models.json > /dev/null 2>&1; then
    print_success "Configuration files exist in image"
    exit 0
else
    print_error "Configuration files missing from image"
    exit 1
fi
