#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"

echo "Checking image size..."

ensure_image_built || exit 1

IMAGE_SIZE=$(docker image inspect "$IMAGE_NAME" --format='{{.Size}}')
IMAGE_SIZE_MB=$((IMAGE_SIZE / 1024 / 1024))

print_info "Image size: ${IMAGE_SIZE_MB}MB"

if [ "$IMAGE_SIZE_MB" -lt 500 ]; then
    print_success "Image size is reasonable (< 500MB)"
    exit 0
else
    print_warning "Image size is larger than expected (${IMAGE_SIZE_MB}MB)"
    exit 0
fi
