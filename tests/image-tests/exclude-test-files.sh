#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"

echo "Verifying test files are excluded from production image..."

ensure_image_built || exit 1

if docker run --rm "$IMAGE_NAME" ls /app/tests 2>/dev/null; then
    print_error "Test files found in production image (should be excluded)"
    exit 1
else
    print_success "Test files correctly excluded from production image"
    exit 0
fi
