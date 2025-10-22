# Development Guide

Guide for developing and contributing to n8n OpenAI Bridge.

## Table of Contents

- [Initial Setup](#initial-setup)
- [Project Structure](#project-structure)
- [Make Commands](#make-commands)
- [Development Workflow](#development-workflow)
- [Testing](#testing)
- [Code Quality](#code-quality)
- [Git Hooks](#git-hooks)
- [Git Workflow](#git-workflow)
- [CI/CD](#cicd)
- [Contributing](#contributing)

## Initial Setup

After cloning the repository, run:

```bash
make setup
```

This will:
- Create `.env` from `.env.example`
- Create `models.json` from `models.json.example`
- Install Git hooks for code quality checks
- Build Docker image
- Run tests to validate setup

## Project Structure

```
n8n-openai-bridge/
├── src/
│   ├── server.js          # Express server setup
│   ├── n8nClient.js       # n8n webhook client (streaming & non-streaming)
│   ├── config.js          # Configuration & models loader
│   ├── routes/            # API endpoints
│   │   ├── health.js      # Health check endpoint
│   │   ├── models.js      # List models endpoint
│   │   ├── chatCompletions.js  # Chat completions endpoint
│   │   └── adminReload.js      # Admin reload endpoint
│   ├── handlers/          # Request handlers
│   │   ├── streamingHandler.js     # SSE streaming handler
│   │   └── nonStreamingHandler.js  # Non-streaming handler
│   ├── middleware/        # Express middleware
│   │   ├── authenticate.js    # Bearer token authentication
│   │   ├── requestLogger.js   # Request logging
│   │   ├── requestId.js       # Request ID tracking
│   │   └── rateLimiter.js     # Rate limiting
│   ├── services/          # Business logic services
│   │   ├── sessionService.js  # Session ID extraction
│   │   ├── userService.js     # User context extraction
│   │   └── validationService.js  # Request validation
│   ├── loaders/           # Model loader architecture
│   │   ├── ModelLoader.js     # Abstract base class
│   │   └── JsonFileModelLoader.js  # JSON file loader
│   └── utils/             # Utility functions
│       ├── errorResponse.js   # Error formatting
│       ├── openaiResponse.js  # OpenAI response formatting
│       ├── masking.js         # Sensitive data masking
│       └── debugSession.js    # Session debug logging
├── tests/
│   ├── server.test.js     # Server endpoint tests
│   ├── n8nClient.test.js  # n8n client tests
│   └── config.test.js     # Configuration tests
├── docker/
│   ├── Dockerfile.build          # Production Docker image
│   ├── Dockerfile.test           # Test Docker image
│   └── docker-compose.dev.yml    # Development Docker Compose
├── models.json            # Model-to-webhook mapping (create from .example)
├── models.json.example    # Example models configuration
├── .env                   # Environment variables (create from .example)
├── .env.example           # Example environment configuration
├── Makefile               # Build and test automation
└── package.json           # Node.js dependencies and scripts
```

## Make Commands

### Setup Command

```bash
make setup         # Initialize development environment (run once after clone)
```

### Development Commands

```bash
make rebuild     # Stop containers, rebuild image, start server (recommended)
make build       # Build Docker image with latest code changes
make start       # Start the server with docker compose
make stop        # Stop running containers
make restart     # Restart the containers (stop + start)
make logs        # Show container logs (follow mode)
make verify      # Verify the running server responds correctly
make clean       # Stop and remove containers, images, and volumes
```

### Testing Commands

```bash
make test                   # Run all tests (unit + image validation)
make test-file FILE=<path>  # Run test file(s), e.g. make test-file FILE=tests/loaders/
```

### Code Quality Commands

```bash
make lint              # Run ESLint to check code quality
make lint-fix          # Run ESLint and auto-fix issues
make format            # Check if code is formatted correctly (Prettier)
make format-fix        # Format code with Prettier
```

Code quality checks run automatically via pre-commit hooks (see [Git Hooks](#git-hooks)).

## Development Workflow

### Typical Workflow

```bash
# 1. Make code changes
nano src/server.js

# 2. Rebuild and test
make rebuild

# 3. Verify it works
make verify

# 4. Run tests
make test

# 5. Check code quality
make lint && make format

# 6. View logs if needed
make logs

# 7. Clean up when done
make clean
```

### Feature Branch Workflow

This project uses feature branches and GitHub Actions for CI/CD with **automated releases on merge**.

**Branch naming conventions:**
- `feature/*` - New features
- `fix/*` - Bug fixes
- `hotfix/*` - Urgent production fixes
- `docs/*` - Documentation updates

**Development workflow:**

```bash
# Create feature branch
git checkout -b feature/my-new-feature

# Make changes and commit
git add .
git commit -m "Add: description of changes"

# Push to GitHub
git push origin feature/my-new-feature

# Create Pull Request on GitHub
# CI will automatically run tests, build Docker image, and security scan
```

**CI checks on every push:**
- Code quality (ESLint + Prettier)
- Unit tests with coverage
- Docker image build test
- Security vulnerability scan
- Health check validation

### Automated Releases

When a PR is merged to `main`, a new release is **automatically created**:
1. The workflow finds the latest version tag (e.g., `v0.0.6`)
2. Increments the patch version (e.g., `v0.0.7`)
3. Creates a GitHub Release with auto-generated notes
4. Builds and publishes Docker images to GitHub Container Registry

**For major/minor version bumps:**
```bash
# Create version tag manually
git tag v1.0.0
git push origin v1.0.0
gh release create v1.0.0 --generate-notes
```

After this, automated releases continue with patch increments from the new version.

See [.github/workflows/README.md](../.github/workflows/README.md) for detailed CI/CD documentation.

## Testing

### Unit Tests

Unit tests run in isolated Docker containers with npm caching for fast rebuilds.

```bash
make test-unit         # Run Jest tests (~5-10s with cache)
```

**Coverage:**
- 95%+ code coverage
- 208 unit tests
- Tests for all core modules (server, n8nClient, config, routes, handlers, middleware, services)

### Image Tests

Modular test scenarios validate the production Docker image:

```bash
make test-image        # Run all image validation tests
```

Run individual test scenarios:

```bash
bash tests/test-image-build.sh invalid-url-validation
```

Available scenarios in `tests/image-tests/`:
- `01-basic-build` - Basic image build
- `02-startup-health` - Container startup and health check
- `03-invalid-url-validation` - Invalid webhook URL handling
- `04-array-models-validation` - Array models validation
- `05-hot-reload` - Model hot-reload functionality



## Code Quality

This project uses ESLint and Prettier to maintain consistent code style.

```bash
make lint          # Check code quality with ESLint
make lint-fix      # Auto-fix ESLint issues
make format        # Check if code is formatted correctly
make format-fix    # Format code with Prettier
```

**Before committing:**
```bash
make lint && make format  # Ensure code passes quality checks
```

## Git Hooks

### Setup

After cloning the repository, run:

```bash
./scripts/setup-hooks.sh
```

This installs pre-commit hooks that automatically check code quality.

### Pre-Commit Hook

The pre-commit hook automatically runs before each commit:

**What it does:**
- Runs `make lint` to check for ESLint violations
- Runs `make format` to verify Prettier formatting
- Blocks commit if any check fails

**Bypass (not recommended):**
```bash
git commit --no-verify
```

The hook ensures consistent code quality without requiring manual setup or npm on the host machine.

## Git Workflow

### Branch Strategy

**Main branch:**
- Protected branch (requires PR and passing CI)
- All releases are tagged from this branch
- Direct pushes should be disabled

**Feature branches:**
- Naming convention: `feature/description`
- Example: `feature/add-rate-limiting`
- CI runs automatically on push
- Requires PR to merge to main

**Fix branches:**
- Naming convention: `fix/description`
- Example: `fix/session-id-detection`
- For bug fixes
- CI runs automatically on push

**Hotfix branches:**
- Naming convention: `hotfix/description`
- Example: `hotfix/security-patch`
- For urgent production fixes
- CI runs automatically on push

### Commit Message Format

Use descriptive commit messages:
- `Add: new feature description`
- `Fix: bug description`
- `Update: change description`
- `Refactor: refactoring description`
- `Docs: documentation changes`
- `Test: test changes`

## CI/CD

### Continuous Integration

**Workflow:** `.github/workflows/ci.yml`

**Triggers:**
- Push to `main`
- Push to feature branches
- Pull requests to `main`

**Jobs:**
1. **Test** - Run unit tests with coverage
2. **Lint** - Check code quality
3. **Docker Build** - Build and test image
4. **Security Scan** - Scan for vulnerabilities

### Automated Releases

**Workflow:** `.github/workflows/release-on-merge.yml`

**Triggers:**
- PR with `release` label merged to `main`

**Process:**
1. Find latest version tag (e.g., `v0.0.6`)
2. Increment patch version (e.g., `v0.0.7`)
3. Create GitHub Release with auto-generated notes
4. Build and push Docker images to GitHub Container Registry

**Image tags created:**
- `0.0.7` - Full version
- `0.0` - Major.Minor
- `0` - Major only
- `latest` - Latest release

See [.github/workflows/README.md](../.github/workflows/README.md) for details.

## Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add: amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

Please ensure:
- All tests pass (`make test`)
- Code passes linting (`make lint`)
- Code is properly formatted (`make format`)
- Docker build succeeds
- Update documentation as needed

## Next Steps

- [Install the bridge](INSTALLATION.md)
- [Configure settings](CONFIGURATION.md)
- [Run tests](TESTING.md)
