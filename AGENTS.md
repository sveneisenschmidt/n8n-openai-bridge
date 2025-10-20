# AGENTS.md

**This file is exclusively for AI coding agents.** Human developers should refer to README.md and CONTRIBUTING.md instead.

## Project Overview

This is an OpenAI-compatible API middleware that bridges OpenAI clients (like Open WebUI, LibreChat) with n8n workflows. It translates OpenAI API requests to n8n webhook calls and supports streaming responses, session tracking, and user context forwarding.

**Tech Stack:**
- Node.js 20 with Express
- Docker for containerization
- Jest for testing (147 unit tests, 78%+ coverage)
- OpenAPI 3.1 specification

## Development Environment

### Initial Setup

```bash
# Clone and setup
git clone git@github.com:sveneisenschmidt/n8n-openai-bridge.git
cd n8n-openai-bridge

# Create configuration from examples
cp .env.example .env
cp models.json.example models.json

# Edit configuration
nano .env           # Add your BEARER_TOKEN
nano models.json    # Add your n8n webhook URLs
```

### Docker Development

We use Docker for consistency. All commands use the Makefile:

```bash
make rebuild    # Stop, rebuild, and start (recommended after code changes)
make start      # Start containers
make stop       # Stop containers
make logs       # View container logs
make verify     # Check if server responds correctly
make clean      # Remove everything (containers, images, volumes)
```

### Package Management

**IMPORTANT:** Always use Docker to run npm commands to ensure consistency:

```bash
# Install dependencies (via Docker)
docker run --rm -v $(PWD):/app -w /app node:20-alpine npm install

# Add a new package (via Docker)
docker run --rm -v $(PWD):/app -w /app node:20-alpine npm install package-name

# Remove a package (via Docker)
docker run --rm -v $(PWD):/app -w /app node:20-alpine npm uninstall package-name

# Update packages (via Docker)
docker run --rm -v $(PWD):/app -w /app node:20-alpine npm update
```

**Never run `npm install` directly on your host machine** - this ensures all developers and CI/CD use the exact same Node.js version and environment.

### Code Quality Tools

```bash
make lint          # Check code quality with ESLint
make lint-fix      # Auto-fix ESLint issues
make format        # Check if code is formatted correctly
make format-fix    # Format code with Prettier
```

### Project Structure

```
n8n-openai-bridge/
├── src/
│   ├── server.js          # Express server & OpenAI API endpoints
│   ├── n8nClient.js       # n8n webhook client (streaming/non-streaming)
│   ├── config.js          # Configuration & environment variables
│   ├── services/          # Business logic (session, user, validation)
│   └── utils/             # Utility functions (masking, etc.)
├── tests/
│   ├── *.test.js          # Unit tests for all modules
│   └── test-image-build.sh # Docker image validation
├── docker/
│   ├── Dockerfile.build          # Production image
│   ├── Dockerfile.test           # Test image
│   └── docker-compose.dev.yml    # Development compose
└── .github/workflows/     # CI/CD automation
```

## Testing

### Run Tests

```bash
make test              # All tests (unit + Docker image validation)
make test-unit         # Unit tests only (Jest with coverage)
make test-image        # Docker image build validation
```

**Important:** Tests always run in Docker containers to ensure consistency. npm/jest commands won't work directly on the host.

### Test Requirements

- All new code must have unit tests
- Maintain 75%+ test coverage
- Tests must pass before merging to main
- Use descriptive test names: `should [expected behavior] when [condition]`

### Writing Clean Tests

**Console Output Suppression:**
- Mock `console.error`, `console.warn`, `console.log` in tests that intentionally trigger logging
- Place spies in `beforeEach`/`beforeAll`, restore in `afterEach`/`afterAll`
- Example:
```javascript
describe('MyComponent', () => {
  let consoleErrorSpy;

  beforeAll(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterAll(() => {
    consoleErrorSpy.mockRestore();
  });
});
```

**Resource Cleanup:**
- Stop file watchers, timers, and connections in `afterEach` to prevent Jest worker hangs
- Track all resources (loaders, connections, intervals) in arrays for cleanup
- Example:
```javascript
describe('watch()', () => {
  let loaders = [];

  beforeEach(() => {
    loaders = [];
  });

  afterEach(() => {
    loaders.forEach(loader => loader.stopWatching());
    loaders = [];
  });

  it('should watch file', () => {
    const loader = new FileLoader();
    loaders.push(loader);  // Track for cleanup
    loader.watch(() => {});
  });
});
```

**Common Mistakes:**
- ❌ Forgetting to stop file watchers → "worker failed to exit gracefully"
- ❌ Not mocking console in error tests → cluttered test output
- ❌ Mocking console per-test instead of per-suite → verbose setup code
- ❌ Manual cleanup calls in tests → use `afterEach` for centralized cleanup

### Running Specific Tests

```bash
# Run specific test file in Docker
docker run --rm n8n-openai-bridge-test npm test -- tests/config.test.js

# Run tests in watch mode (for development)
npm run test:watch  # Only works if you have node_modules locally
```

### Docker Image Tests

The `tests/test-image-build.sh` script validates:

1. **Image Build** - Production image builds successfully
2. **Image Size** - Reasonable size (< 500MB)
3. **Built-in Config** - Default .env and models.json exist
4. **Config Content** - Placeholder values are correct
5. **Container Startup** - Server starts without errors
6. **Health Endpoint** - Responds with valid JSON structure
7. **Models Endpoint** - Returns OpenAI-compatible format
8. **ModelLoader Integration** - Successfully loads models.json
9. **Test Exclusion** - Test files not in production image
10. **Dependencies** - Only production deps installed
11. **Custom Models** - Volume mounts work correctly
12. **Format Validation** - Rejects invalid model formats (arrays)
13. **URL Validation** - Rejects invalid model URLs

**Running Docker tests:**
```bash
make test-image    # Full Docker image validation (~2-3 minutes)
./tests/test-image-build.sh  # Direct execution
```

**Test Philosophy:**
- Tests are ModelLoader-agnostic (work with any loader implementation)
- Tests validate error handling and graceful degradation
- Tests use `docker exec wget` instead of host networking for reliability

## Code Conventions

### File Organization

- **src/**: Production code only
- **tests/**: Mirror src/ structure (e.g., `src/config.js` → `tests/config.test.js`)
- **One class per file**: File name matches class name
- **Lowercase directories**: services/, loaders/, utils/

### Copyright Headers

All source files include AGPL-3.0 license headers. When creating new files:
- Copy the existing copyright header from similar files
- Keep the original copyright holder (Sven Eisenschmidt)
- **Never modify copyright headers or add your name as an AI agent**

### Coding Style

**Automated Code Quality:**
This project uses ESLint and Prettier to enforce consistent code style.

```bash
make lint          # Check for code quality issues
make lint-fix      # Auto-fix ESLint issues
make format        # Check if code is formatted
make format-fix    # Format code with Prettier
```

**Always run linting before committing:**
```bash
make lint && make format
```

**Code Style Rules:**
- Use ES6+ features (async/await, destructuring, etc.)
- Prefer `const` over `let`, avoid `var`
- Use single quotes for strings
- Use template literals for string concatenation
- Add JSDoc comments for public methods
- Use descriptive variable names (no single letters except loop counters)
- 2 spaces indentation
- Semicolons required
- Always use curly braces for control structures

### Error Handling

- Always use try-catch for async operations
- Log errors with timestamps: `console.error(\`[${new Date().toISOString()}] Error: ${error.message}\`)`
- Return meaningful error messages to clients
- Never expose internal errors or stack traces to API responses

### Adding New Features

1. Create feature branch: `git checkout -b feature/my-feature`
2. Implement code in src/
3. Add unit tests in tests/
4. Run `make test` to verify
5. Update documentation (README.md, openapi.yaml)
6. Commit with descriptive message: `Add: feature description`
7. Push and create Pull Request

## Git Workflow

### Branch Naming

- `feature/*` - New features
- `fix/*` - Bug fixes
- `hotfix/*` - Urgent production fixes
- `refactor/*` - Code refactoring
- `docs/*` - Documentation updates

### Commit Messages

Follow conventional commits:

```
Add: new feature description
Fix: bug description
Update: changes to existing feature
Refactor: code restructuring
Docs: documentation changes
Test: test additions or modifications
```

**Important for AI Agents:** Never add your own name or attribution to commit messages.

### Pull Requests

**Important for AI Agents:** Never add your own name or attribution to PR titles, descriptions, or comments.

Before creating a PR:

```bash
# Ensure all tests pass
make test

# Verify server works
make rebuild
make verify

# Check for uncommitted changes
git status
```

**PR Checklist:**
- [ ] All tests pass (`make test`)
- [ ] Test coverage maintained (75%+)
- [ ] Code passes linting (`make lint`)
- [ ] Code is formatted (`make format`)
- [ ] Documentation updated (README.md, openapi.yaml)
- [ ] No console.log() statements (use structured logging)
- [ ] .env.example updated if new env vars added
- [ ] Commit messages follow convention

### CI/CD

GitHub Actions automatically run on every push:
- Unit tests with coverage
- Docker image build
- Security vulnerability scan
- Health check validation

When merged to `main`, a new release is automatically created with patch version increment.

## Architecture Notes

### Request Flow

```
Client → Express Server → Auth Middleware → Route Handler → n8nClient → n8n Webhook
                                              ↓
                                         Session/User Context Extraction
                                              ↓
                                         Model Validation
                                              ↓
                                         Streaming/Non-streaming Response
```

### Key Components

**server.js**
- Express server setup
- OpenAI API endpoints (/v1/chat/completions, /v1/models)
- Bearer token authentication
- Health check endpoint

**n8nClient.js**
- Handles HTTP calls to n8n webhooks
- Streaming and non-streaming response parsing
- Error handling and retries

**config.js**
- Environment variable parsing
- Model configuration loading
- File watcher for hot-reload
- Header configuration for session/user context

**services/**
- sessionService.js: Extract session ID from requests
- userService.js: Extract user context (ID, email, name, role)
- validationService.js: Validate OpenAI API requests

### ModelLoader System

The bridge uses a flexible loader pattern for model configuration:

**Base Class:** `src/loaders/ModelLoader.js`
- Abstract base class defining the loader interface
- `loadSync()`: Synchronous loading for startup
- `load()`: Asynchronous loading for runtime
- `watch(callback)`: Optional file watching
- `validateModels(models)`: Validation logic

**JsonFileModelLoader:** `src/loaders/JsonFileModelLoader.js`
- Default implementation for JSON file loading
- Uses `fs.readFileSync()` for sync loading
- Uses `fs.watch()` with 100ms debounce for auto-reload
- Validates model format and URLs

**Integration in config.js:**
```javascript
constructor() {
  // Initialize ModelLoader (default: JsonFileModelLoader)
  this.modelLoader = this.createModelLoader();

  // Load models synchronously on startup
  this.models = this.modelLoader.loadSync();

  // Setup file watcher for hot-reload
  this.setupFileWatcher();
}
```

**Why synchronous loading on startup?**
- Prevents race condition where server starts before models are loaded
- Health endpoint doesn't depend on models being loaded
- Server is immediately ready to serve requests

### Configuration

**Environment Variables (.env):**
- `PORT`: Server port (default: 3333)
- `BEARER_TOKEN`: Auth token for API requests
- `N8N_BEARER_TOKEN`: Auth token for n8n webhooks (optional)
- `MODELS_CONFIG`: Path to models.json (default: ./models.json)
- `LOG_REQUESTS`: Enable detailed logging (true/false)
- `SESSION_ID_HEADERS`: Comma-separated list of headers to check for session ID
- `USER_*_HEADERS`: Headers for user context (ID, email, name, role)

**Models Configuration (models.json):**
```json
{
  "model-name": "https://n8n.example.com/webhook/abc123/chat"
}
```

Changes to models.json are automatically detected and reloaded without restart.

## Security

- Never commit .env or models.json (only .example files)
- Use BEARER_TOKEN for all API requests in production
- N8N_BEARER_TOKEN should be used if n8n webhooks require auth
- Validate all user inputs before processing
- Use HTTPS in production (configure reverse proxy)
- Docker images run as non-root user

## Common Issues

**Tests failing locally:**
- Always use `make test` (tests run in Docker, not on host)
- If tests pass in CI but fail locally, rebuild test image: `make clean && make test`

**Models not loading:**
- Check models.json syntax with `cat models.json | jq`
- Verify file path in .env matches actual location
- Check Docker volume mounts in docker-compose.dev.yml

**Server not responding:**
- Check logs: `make logs`
- Verify port is not in use: `lsof -i :3333`
- Ensure .env file exists and BEARER_TOKEN is set

**File watcher not working:**
- File watching works in Docker on macOS/Linux
- On Windows, you may need to use polling mode
- Restart server after major changes: `make rebuild`

## Resources for Agents

- **README.md**: User documentation and installation instructions
- **openapi.yaml**: Complete API specification
- **docs/api.html**: Interactive Swagger UI
- **LICENSE**: AGPL-3.0 license details
- **.github/workflows/README.md**: CI/CD documentation
- **.github/pull_request_template.md**: Pull Request template

## Extending ModelLoader

To add support for different model sources (e.g., HTTP API, Database):

### 1. Create New Loader Class

```javascript
// src/loaders/HttpModelLoader.js (example - not implemented)
const ModelLoader = require('./ModelLoader');

class HttpModelLoader extends ModelLoader {
  constructor(apiUrl) {
    super();
    this.apiUrl = apiUrl;
  }

  loadSync() {
    // Use synchronous HTTP library or throw error
    throw new Error('HttpModelLoader does not support synchronous loading');
  }

  async load() {
    const response = await fetch(this.apiUrl);
    const models = await response.json();
    this.validateModels(models);
    return models;
  }

  watch(callback) {
    // Implement polling or webhook for updates
    setInterval(async () => {
      const models = await this.load();
      callback(models);
    }, 60000); // Poll every minute
  }
}
```

### 2. Integrate in config.js

```javascript
createModelLoader() {
  const loaderType = process.env.MODEL_LOADER_TYPE || 'json';

  switch (loaderType) {
    case 'json':
      return new JsonFileModelLoader(this.modelsConfig);
    case 'http':
      return new HttpModelLoader(process.env.MODEL_API_URL);
    default:
      throw new Error(`Unknown loader type: ${loaderType}`);
  }
}
```

### 3. Add Tests

Create tests similar to `tests/loaders/JsonFileModelLoader.test.js` for your new loader.

### 4. Update Documentation

- Add new env vars to .env.example
- Document new loader in README.md
- Add examples for configuration

## Important Reminders for AI Agents

- Never add your name to any files, commits, or PRs
- Keep communication professional: avoid decorative symbols in all project artifacts
- Always follow the existing code style and conventions
- Run `make lint && make format` before committing to ensure code quality
- Run `make test` before committing changes
- Keep copyright headers unchanged
- This project is AGPL-3.0 licensed - modified versions must remain open source
