#!/bin/bash

# Docker Image Build Test Runner
# Runs modular test scenarios from tests/image-tests/

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
IMAGE_TESTS_DIR="$SCRIPT_DIR/image-tests"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Usage
usage() {
    echo "Usage: $0 [OPTIONS] [TEST_FILES...]"
    echo ""
    echo "Options:"
    echo "  -h, --help           Show this help message"
    echo "  -l, --list           List all available tests"
    echo "  -a, --all            Run all tests (default)"
    echo "  -c, --cleanup        Cleanup images and containers after tests"
    echo ""
    echo "Examples:"
    echo "  $0                                     Run all tests"
    echo "  $0 invalid-url-validation              Run specific test"
    echo "  $0 build-image container-startup       Run multiple tests"
    echo "  $0 image-tests/models-endpoint.sh      Run by full path"
    echo "  $0 --list                              List all available tests"
    echo "  $0 -c invalid-url-validation           Run test and cleanup"
    exit 0
}

# List available tests
list_tests() {
    echo "Available tests:"
    echo ""
    for test_file in "$IMAGE_TESTS_DIR"/*.sh; do
        if [ -f "$test_file" ] && [ "$(basename "$test_file")" != "common.sh" ]; then
            test_name=$(basename "$test_file" .sh)
            printf "  %s\n" "$test_name"
        fi
    done
    echo ""
}

# Parse arguments
TESTS_TO_RUN=()
RUN_ALL=true
CLEANUP=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            usage
            ;;
        -l|--list)
            list_tests
            exit 0
            ;;
        -a|--all)
            RUN_ALL=true
            shift
            ;;
        -c|--cleanup)
            CLEANUP=true
            shift
            ;;
        *)
            TESTS_TO_RUN+=("$1")
            RUN_ALL=false
            shift
            ;;
    esac
done

# Cleanup function
cleanup_all() {
    if [ "$CLEANUP" = true ]; then
        echo ""
        echo "Cleaning up..."
        docker rm -f test-bridge-* 2>/dev/null || true
        docker rmi n8n-openai-bridge:test-build 2>/dev/null || true
        echo -e "${GREEN}✓${NC} Cleanup complete"
    fi
}

trap cleanup_all EXIT

# Main execution
echo "======================================"
echo "Docker Image Build Test Runner"
echo "======================================"
echo ""

# Determine which tests to run
if [ "$RUN_ALL" = true ]; then
    TEST_FILES=()
    for test_file in "$IMAGE_TESTS_DIR"/*.sh; do
        if [ "$(basename "$test_file")" != "common.sh" ]; then
            TEST_FILES+=("$test_file")
        fi
    done
else
    TEST_FILES=()
    for test_arg in "${TESTS_TO_RUN[@]}"; do
        # Check if it's a full path
        if [ -f "$test_arg" ]; then
            TEST_FILES+=("$test_arg")
        # Check if it's a basename without .sh
        elif [ -f "$IMAGE_TESTS_DIR/$test_arg.sh" ]; then
            TEST_FILES+=("$IMAGE_TESTS_DIR/$test_arg.sh")
        # Check if it's a basename with .sh
        elif [ -f "$IMAGE_TESTS_DIR/$test_arg" ]; then
            TEST_FILES+=("$IMAGE_TESTS_DIR/$test_arg")
        else
            echo -e "${RED}✗${NC} Test not found: $test_arg"
            exit 1
        fi
    done
fi

# Run tests
PASSED=0
FAILED=0
TOTAL=0

for test_file in "${TEST_FILES[@]}"; do
    if [ ! -f "$test_file" ]; then
        continue
    fi
    
    TOTAL=$((TOTAL + 1))
    test_name=$(basename "$test_file" .sh)
    
    echo ""
    if bash "$test_file"; then
        PASSED=$((PASSED + 1))
    else
        FAILED=$((FAILED + 1))
        echo -e "${RED}✗ Test failed: $test_name${NC}"
    fi
done

# Summary
echo ""
echo "======================================"
if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All tests passed!${NC} ($PASSED/$TOTAL)"
else
    echo -e "${RED}✗ Some tests failed${NC}"
    echo "  Passed: $PASSED/$TOTAL"
    echo "  Failed: $FAILED/$TOTAL"
fi
echo "======================================"

exit $FAILED
