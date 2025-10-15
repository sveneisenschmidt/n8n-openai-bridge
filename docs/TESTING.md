# Test Suite Documentation

This directory contains the test suite for the n8n OpenAI Bridge project.

## Test Structure

### 1. Unit Tests (Server Logic)

**Location:** `tests/*.test.js`
**Framework:** Jest
**Run with:** `make test-unit`

Tests the core server logic including:
- Configuration loading and hot-reload
- n8n client communication (streaming & non-streaming)
- API endpoints and routing

**Coverage:**
- `config.js` - Configuration management and file watching
- `n8nClient.js` - n8n webhook communication and response parsing
- `server.js` - Express server and API endpoints (integration tests)

### 2. Docker Image Tests

**Location:** `tests/test-image-build.sh`
**Framework:** Pure Bash (no external dependencies)
**Run with:** `make test-image`

Tests the production Docker image to ensure:
- Image builds successfully
- Image size is reasonable (< 500MB)
- Required files exist and have correct content
- Built-in configuration files (`docker/.env`, `docker/models.json`) are correct
- Test files are excluded from production image
- Container starts successfully (log polling)
- HTTP endpoints are accessible
- No dev dependencies installed
- Custom `models.json` can be mounted

**Test Coverage:**
1. ✅ Docker image builds
2. ✅ Image size check
3. ✅ Configuration files exist
4. ✅ docker/.env content validation
5. ✅ docker/models.json placeholder model validation
6. ✅ Container startup (log polling for "Server running on port")
7. ✅ Health endpoint responding
8. ✅ Built-in `docker-default-model` available via API
9. ✅ Test files excluded from production image
10. ✅ No dev dependencies (jest, nodemon, supertest)
11. ✅ Custom models.json mount works

## Running Tests

### Run All Tests

```bash
make test
```

This runs both unit tests and Docker image tests sequentially.

**Expected output:**
```
======================================
Running Unit Tests (Server Logic)
======================================
...
✓ Unit tests passed!

======================================
Running Docker Image Tests
======================================
...
✓ All Docker image build tests passed!

======================================
✓ All tests passed successfully!
======================================
```

### Run Unit Tests Only

```bash
make test-unit
```

Builds a test Docker image with `Dockerfile.test` and runs Jest tests inside it.

### Run Docker Image Tests Only

```bash
make test-image
```

Builds the production Docker image and validates it with comprehensive Bash tests.

## Test Implementation Details

### Log Polling for Container Startup

Instead of static `sleep` commands, the image tests use log polling:

```bash
# Wait for "Server running on port" in logs
while [ $WAITED -lt $MAX_WAIT ]; do
    if docker logs "$TEST_CONTAINER" 2>&1 | grep -q "Server running on port"; then
        echo "✓ Container started successfully"
        break
    fi
    sleep 1
    WAITED=$((WAITED + 1))
done
```

This ensures tests are fast and reliable.

### No External Dependencies

The Docker image tests use only:
- `bash` - Shell scripting
- `docker` - Container management
- `curl` - HTTP requests
- `python3` - JSON validation (built into macOS/Linux)

No external tools like Goss, Container Structure Tests, or other testing frameworks required.

## Test Files

| File | Purpose |
|------|---------|
| `config.test.js` | Unit tests for configuration management |
| `n8nClient.test.js` | Unit tests for n8n webhook client |
| `server.test.js` | Integration tests for API endpoints |
| `test-image-build.sh` | Bash script for Docker image validation |
| `README.md` | This documentation |

## Writing New Tests

### Adding Unit Tests

Add new test files in `tests/` with the `.test.js` extension:

```javascript
describe('My Feature', () => {
  test('should do something', () => {
    // Test code
  });
});
```

### Adding Docker Image Tests

Edit `tests/test-image-build.sh` to add new test cases:

```bash
# Test N: Your new test
echo "Test N: Testing something new..."
if docker run --rm "$IMAGE_NAME" test -f /app/new-file.txt; then
    echo "✓ New test passed"
else
    echo "✗ New test failed"
    exit 1
fi
echo ""
```

## CI/CD Integration

The test suite is automatically run by GitHub Actions on:
- Every push to `main` or feature branches
- Every pull request to `main`

See `.github/workflows/ci.yml` for the CI configuration.

## Troubleshooting

### Unit Tests Failing

```bash
# Run tests with verbose output
docker run --rm n8n-openai-bridge-test npm test -- --verbose

# Check test logs
make test-unit 2>&1 | less
```

### Docker Image Tests Failing

```bash
# Run with set -x for debug output
bash -x tests/test-image-build.sh

# Check specific test
docker build -t n8n-openai-bridge:test-build .
docker run -d --name manual-test -e BEARER_TOKEN=test n8n-openai-bridge:test-build
docker logs -f manual-test
```

### Container Won't Start

```bash
# Check logs directly
docker logs <container-name>

# Run interactively
docker run --rm -it -e BEARER_TOKEN=test n8n-openai-bridge:test-build sh
```

## Performance

Typical test execution times:
- Unit tests: ~5-10 seconds (with Docker cache)
- Image tests: ~15-25 seconds (with Docker cache)
- Total: ~20-35 seconds

First run may take longer due to Docker image downloads and npm package installation.

## Design Decisions

### Why Bash Instead of Goss/Container Structure Tests?

1. **Zero Dependencies** - Works on any system with Docker and curl
2. **Simple** - Easy to understand and modify
3. **Maintainable** - No external tool updates to track
4. **Fast** - No tool installation overhead
5. **Flexible** - Easy to add custom tests

The Bash script provides comprehensive testing without external dependencies, making it ideal for CI/CD environments and local development.
