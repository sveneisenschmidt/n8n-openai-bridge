# AGENTS.md

**This file is exclusively for AI coding agents.** Human developers should refer to README.md and docs/ instead.

## Project Overview

OpenAI-compatible API middleware that bridges OpenAI clients with n8n workflows. Translates OpenAI API requests to n8n webhook calls with streaming support, session tracking, and user context forwarding.

**Stack:** Node.js 20, Express, Docker, Jest (95%+ coverage)

## Quick Start

```bash
# Setup
make setup              # Creates .env, models.json, installs hooks, runs tests

# Development cycle
make rebuild            # Rebuild and restart (after code changes)
make test              # Run all tests (unit + image validation)
make lint && make format  # Check code quality

# View logs
make logs

# Cleanup
make clean
```

## Project Structure

```
n8n-openai-bridge/
├── src/
│   ├── server.js          # Express server
│   ├── Bootstrap.js       # Application lifecycle orchestration
│   ├── n8nClient.js       # n8n webhook client
│   ├── config/            # Configuration (ENV, server settings)
│   ├── repositories/      # Data repositories (model state)
│   ├── factories/         # Factory classes (loaders, notifiers)
│   ├── routes/            # API endpoints (health, models, chat, admin)
│   ├── handlers/          # Request handlers (streaming, non-streaming)
│   ├── middleware/        # Express middleware (auth, logging, rate limiting)
│   ├── services/          # Business logic (session, user, validation)
│   ├── loaders/           # Model loader architecture (file, n8n-api, static)
│   ├── notifiers/         # Webhook notifiers (model changes)
│   └── utils/             # Utility functions
├── tests/                 # Unit tests
│   ├── image-tests/       # Modular image validation scenarios
│   └── test-image-build.sh  # Image test orchestrator
├── docker/                # Docker configuration
├── docs/                  # Full documentation
└── Makefile               # Build automation
```

## Architecture

**Request Flow:**
```
Client → Auth Middleware → Route Handler → n8nClient → n8n Webhook
              ↓
         Session/User Context → Model Validation → Streaming/Non-streaming Response
```

**Key Components:**
- `Bootstrap.js` - Orchestrates lifecycle, wires dependencies
- `Config.js` - ENV parsing, server settings
- `ModelRepository.js` - Manages model state, queries, reloading
- `ModelLoaderFactory.js` - Creates loaders based on `MODEL_LOADER_TYPE`
- `server.js` - Express setup, OpenAI endpoints
- `n8nClient.js` - n8n webhook communication
- `taskDetectorService.js` - Detects automated task generation requests (optional)

**Model Loading System:**
- `JsonFileModelLoader` (TYPE: `file`) - Default, reads `models.json`, hash-based hot-reload
- `N8nApiModelLoader` (TYPE: `n8n-api`) - Auto-discovers tagged workflows via n8n API
- `StaticModelLoader` (TYPE: `static`) - Testing only, loads from env var

See docs/MODELLOADER.md for details.

## Development Workflow

### Adding Features

```bash
git checkout -b feature/my-feature
# Make changes in src/
# Add tests in tests/
make test
make lint && make format
git commit -m "Add: feature description"
git push origin feature/my-feature
# Create PR (CI runs automatically)
```

### Testing Philosophy

- **Unit tests:** 95%+ coverage required, run in Docker
- **Image tests:** Modular Bash scenarios validate production image
- **Console mocking:** Mock console in tests that trigger logging
- **Resource cleanup:** Track watchers/timers, clean in `afterEach`
- **No placeholders:** Never guess parameters, fail if missing

### Package Management

**Always use Docker for npm commands:**
```bash
docker run --rm -v $(PWD):/app -w /app node:20-alpine npm install
docker run --rm -v $(PWD):/app -w /app node:20-alpine npm install package-name
```

Never run `npm install` on host machine.

## Code Conventions

### Style

- ES6+ features (async/await, destructuring)
- `const` over `let`, never `var`
- Single quotes, template literals for concatenation
- 2 spaces indentation, semicolons required
- JSDoc for public methods
- Descriptive names (no single letters except loops)

### File Organization

- One class per file, file name matches class name
- Lowercase directories (services/, loaders/, utils/)
- Tests mirror src/ structure (src/utils/session.js → tests/utils/session.test.js)
- `src/services/` → Classes with state/dependencies (e.g., `TaskDetectorService`, `WebhookNotifier`)
- `src/utils/` → Stateless pure functions (e.g., `sessionExtractor.js`, `userExtractor.js`, `requestValidator.js`)

### Copyright Headers

All source files include AGPL-3.0 license headers. When creating files:
- Copy existing copyright header from similar files
- Keep original copyright holder (Sven Eisenschmidt)
- **Never modify headers or add your name as an AI agent**

### Error Handling

- Try-catch for async operations
- Log with timestamps: `console.error(\`[${new Date().toISOString()}] Error: ${error.message}\`)`
- Return meaningful error messages to clients
- Never expose internal errors/stack traces to API responses

## Git Workflow

### Branch Naming

- `feature/*` - New features
- `fix/*` - Bug fixes
- `hotfix/*` - Urgent production fixes
- `refactor/*` - Code refactoring
- `docs/*` - Documentation updates

### Commit Messages

```
Add: new feature description
Fix: bug description
Update: changes to existing feature
Refactor: code restructuring
Docs: documentation changes
Test: test additions/modifications
```

**Never add your name to commits, PRs, or code.**

### PR Checklist

- [ ] All tests pass (`make test`)
- [ ] Test coverage maintained (95%+)
- [ ] Code passes linting (`make lint`)
- [ ] Code is formatted (`make format`)
- [ ] Documentation updated if needed
- [ ] No console.log() statements
- [ ] .env.example updated if new env vars added

## CI/CD

**On every push:**
- Unit tests with coverage
- Code quality (ESLint + Prettier)
- Docker image build
- Security vulnerability scan

**On merge to main:**
- Automated patch version release
- Docker images published to GHCR

See .github/workflows/README.md for details.

## Configuration Quick Reference

```bash
# Essential
PORT=3333
BEARER_TOKEN=your-api-key-here
MODEL_LOADER_TYPE=file                    # Options: file, n8n-api, static
MODELS_CONFIG_FILE=./models.json
```

See **docs/CONFIGURATION.md** for all environment variables including:
- Model loading (file, n8n-api, static loaders)
- Session & user context headers
- Timeout configuration
- Webhook notifier
- Task detection

## Common Issues

| Problem | Solution |
|---------|----------|
| Tests failing locally | Use `make test` (tests run in Docker) |
| Models not loading | Check `models.json` syntax with `cat models.json \| jq` |
| Server not responding | Check logs: `make logs` |
| File watcher not working | Restart: `make rebuild` |
| n8n API 401 | Regenerate token in Settings > n8n API |
| No models discovered | Ensure workflows have chatTrigger node AND correct tag |

See docs/TROUBLESHOOTING.md for comprehensive guide.

## Documentation Resources

- **docs/DEVELOPMENT.md** - Development guide, project structure, make commands
- **docs/TESTING.md** - Test suite documentation
- **docs/CONFIGURATION.md** - All environment variables
- **docs/MODELLOADER.md** - Model loader architecture
- **docs/N8N_SETUP.md** - Configure n8n workflows
- **docs/USAGE.md** - API usage examples
- **docs/INTEGRATIONS.md** - Client integration (Open WebUI, LibreChat)
- **docs/TROUBLESHOOTING.md** - Common issues and solutions
- **openapi.yaml** - Complete API specification
- **.github/workflows/README.md** - CI/CD documentation

## Important Reminders

- Never add your name to any files, commits, or PRs
- Always follow existing code style and conventions
- Run `make lint && make format` before committing
- Run `make test` before committing
- Keep copyright headers unchanged
- This project is AGPL-3.0 licensed
- Use descriptive variable names and JSDoc comments
- Maintain 95%+ test coverage for all new code
