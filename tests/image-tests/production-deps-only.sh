#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"

echo "Checking installed dependencies..."

ensure_image_built || exit 1

DEV_DEPS=$(docker run --rm "$IMAGE_NAME" sh -c 'cd /app && npm list --depth=0 2>/dev/null | grep -E "(jest|nodemon|supertest|eslint|prettier)" | grep -v "UNMET" || true')

if [ -z "$DEV_DEPS" ]; then
    print_success "No dev dependencies installed (production-only)"
    exit 0
else
    print_error "Dev dependencies found in production image:"
    echo "$DEV_DEPS"
    exit 1
fi
