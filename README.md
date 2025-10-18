# n8n OpenAI Bridge

OpenAI-compatible API middleware for n8n workflows. Use your n8n agents and workflows as OpenAI models in any OpenAI-compatible client.

## Architecture

```
   ┌─────────────────────────────────────────────┐
   │  OpenAI Clients (Open WebUI, LibreChat...)  │
   └────────────────────┬────────────────────────┘
                        │ OpenAI API Format
                        │ /v1/chat/completions
                        ▼
              ┌─────────────────────┐
              │ n8n OpenAI Bridge   │
              │ • Auth & Routing    │
              │ • Session Tracking  │
              │ • Format Translation│
              └──────────┬──────────┘
                         │ n8n Webhook
              ┌──────────┼──────────┐
              ▼          ▼          ▼
         ┌────────┐ ┌────────┐ ┌────────┐
         │  n8n   │ │  n8n   │ │  n8n   │
         │ Agent  │ │ Agent  │ │ Agent  │
         │(Claude)│ │ (GPT-4)│ │(Custom)│
         └────────┘ └────────┘ └────────┘
              │          │          │
              └──────────┴──────────┘
                         │
                    AI Response
                (Streaming/Non-streaming)
```

## Features

- Full OpenAI Chat Completion API compatibility
- Streaming and non-streaming responses
- Multi-model support via JSON configuration
- Session tracking for conversation memory
- User context forwarding (ID, email, name, role)
- Bearer token authentication
- Docker ready with health checks
- Hot-reload models without restart
- Complete OpenAPI 3.1 documentation
- 78%+ test coverage with 147 unit tests

## Model Loading System

The bridge uses a flexible ModelLoader architecture that supports different model sources:

- **JsonFileModelLoader** (default): Loads models from `models.json`
- Hot-reload: Changes to `models.json` are detected automatically (100ms debounce)
- Validation: Models must be an object with valid webhook URLs
- Graceful degradation: Server continues running even if model loading fails

**Model Configuration Format:**
```json
{
  "model-id": "https://n8n.example.com/webhook/abc123/chat"
}
```

**Model Validation:**
- ✅ Models must be a JSON object (not an array)
- ✅ Each model URL must be a valid HTTP/HTTPS URL
- ✅ Invalid models are logged but don't prevent server startup
- ✅ Server starts with empty model list if validation fails

## Installation

### Option 1: Docker Image (Recommended)

The Docker image comes with default configuration files built-in. Simply mount your custom `models.json` to configure your n8n webhooks.

**Quick Start:**

```bash
# Create your models configuration
cat > models.json << 'EOF'
{
  "my-agent": "https://n8n.example.com/webhook/abc123/chat"
}
EOF

# Run container
docker run -d \
  --name n8n-openai-bridge \
  -p 3333:3333 \
  -e BEARER_TOKEN=your-secret-api-key-here \
  -v $(pwd)/models.json:/app/models.json:ro \
  ghcr.io/sveneisenschmidt/n8n-openai-bridge:latest

# Check health
curl http://localhost:3333/health
```

**Docker Compose:**

```yaml
services:
  n8n-openai-bridge:
    image: ghcr.io/sveneisenschmidt/n8n-openai-bridge:latest
    container_name: n8n-openai-bridge
    ports:
      - "3333:3333"
    environment:
      - BEARER_TOKEN=your-secret-api-key-here
      - N8N_BEARER_TOKEN=  # Optional: for authenticated n8n webhooks
      - LOG_REQUESTS=false
      - SESSION_ID_HEADERS=X-Session-Id,X-Chat-Id,X-OpenWebUI-Chat-Id
    volumes:
      - ./models.json:/app/models.json:ro
    restart: unless-stopped
```

**Available image tags:**
- `latest` - Latest stable release
- `0.0.3` - Specific version
- `0.0` - Latest patch version of 0.0.x
- `0` - Latest minor version of 0.x.x

**Built-in vs Custom Configuration:**

The Docker image includes built-in configuration files:
- Built-in `.env` with default settings
- Built-in `models.json` with placeholder model (`docker-default-model`)

**To use custom configuration:**
- Mount your `models.json` to `/app/models.json` (replaces built-in models)
- Set environment variables via `-e` or Docker Compose (overrides built-in .env)

**Verification:**
```bash
# Check if your custom models are loaded
curl -H "Authorization: Bearer your-token" http://localhost:3333/v1/models

# If you see "docker-default-model" → your mount is NOT working
# If you see your custom models → configuration is correct ✓
```

### Option 2: Build from Source

```bash
# Clone the repository
git clone git@github.com:sveneisenschmidt/n8n-openai-bridge.git
cd n8n-openai-bridge

# Create configuration files from examples
cp .env.example .env
cp models.json.example models.json

# Edit configuration
nano .env           # Add your BEARER_TOKEN
nano models.json    # Add your n8n webhook URLs
```

**Start with Docker Compose:**

```bash
make rebuild  # Stops, rebuilds, starts (recommended)
make start    # Just start
make stop     # Stop containers
make logs     # View logs
make test     # Run unit tests (always uses latest code)
make verify   # Check if server responds
make clean    # Remove everything
make help     # Show all commands
```

Or manually: `docker compose -f docker/docker-compose.dev.yml up -d`

## Configuration

### Environment Variables (.env)

```bash
PORT=3333                        # Server port
BEARER_TOKEN=your-api-key        # Auth for requests TO this bridge
N8N_BEARER_TOKEN=                # Optional: Auth for requests FROM bridge to n8n
MODELS_CONFIG=./models.json      # Path to models config
LOG_REQUESTS=false               # Debug logging

# Session & User Context Headers (comma-separated, first found wins)
SESSION_ID_HEADERS=X-Session-Id,X-Chat-Id
USER_ID_HEADERS=X-User-Id
USER_EMAIL_HEADERS=X-User-Email
USER_NAME_HEADERS=X-User-Name
USER_ROLE_HEADERS=X-User-Role

DOCKER_NETWORK_NAME=proxy        # Docker network for compose
```

**Authentication Flow:**
- `BEARER_TOKEN` - Protects this bridge (clients → bridge)
- `N8N_BEARER_TOKEN` - Protects n8n webhooks (bridge → n8n)
- Leave `N8N_BEARER_TOKEN` empty if your n8n webhooks are public

### Models (models.json)

```json
{
  "model-name": "https://n8n.example.com/webhook/abc123/chat"
}
```

### n8n Webhook Payload

Your n8n workflow receives:
```json
{
  "systemPrompt": "System message",
  "currentMessage": "Latest user message",
  "chatInput": "Latest user message (alias)",
  "messages": [
    {"role": "user", "content": "Hello"},
    {"role": "assistant", "content": "Hi!"}
  ],
  "sessionId": "uuid-or-custom-id",
  "userId": "user-identifier",
  "userEmail": "user@example.com",
  "userName": "John Doe",
  "userRole": "admin"
}
```

**User Context Fields:**
- `userId` - User identifier (required, defaults to "anonymous")
- `userEmail` - User email address (optional)
- `userName` - User display name (optional)
- `userRole` - User role/permission level (optional)

**Response format:**
- **Streaming:** JSON chunks with `content`, `text`, `output` or `message` field
- **Non-streaming:** String or JSON with one of the above fields

## API Documentation

**Complete OpenAPI 3.1 Specification:** [openapi.yaml](openapi.yaml)

**Interactive Documentation:** Open [docs/api.html](docs/api.html) in your browser for Swagger UI

### Quick Reference

**Health Check** (no auth required)
```bash
GET /health
```

**List Models**
```bash
GET /v1/models
Authorization: Bearer your-secret-api-key-here
```

**Chat Completion**
```bash
POST /v1/chat/completions
Authorization: Bearer your-secret-api-key-here
Content-Type: application/json

{
  "model": "my-agent",
  "messages": [
    {"role": "user", "content": "Hello!"}
  ],
  "stream": false
}
```

**Reload Models Configuration**
```bash
POST /admin/reload
Authorization: Bearer your-secret-api-key-here
```

Models are also automatically reloaded when `models.json` is modified.

## Integration Examples

### Open WebUI

**Setup:** Settings → Connections → OpenAI API
- API Base URL: `http://your-server:3333/v1`
- API Key: Your `BEARER_TOKEN` from `.env`
- Set `ENABLE_FORWARD_USER_INFO_HEADERS=true` (required for session and user tracking)

**User Context Integration:**

Open WebUI automatically forwards user information via HTTP headers when `ENABLE_FORWARD_USER_INFO_HEADERS=true`:
- `X-OpenWebUI-User-Id` - User's unique identifier
- `X-OpenWebUI-User-Email` - User's email address
- `X-OpenWebUI-User-Name` - User's display name
- `X-OpenWebUI-User-Role` - User's role (admin, user, etc.)
- `X-OpenWebUI-Chat-Id` - Chat session identifier

To enable OpenWebUI header support, add them to your `.env`:

```bash
SESSION_ID_HEADERS=X-Session-Id,X-Chat-Id,X-OpenWebUI-Chat-Id
USER_ID_HEADERS=X-User-Id,X-OpenWebUI-User-Id
USER_EMAIL_HEADERS=X-User-Email,X-OpenWebUI-User-Email
USER_NAME_HEADERS=X-User-Name,X-OpenWebUI-User-Name
USER_ROLE_HEADERS=X-User-Role,X-OpenWebUI-User-Role
```

This allows your n8n workflows to:
- Personalize responses based on user role
- Track user-specific conversations
- Implement role-based access control
- Log user activity for analytics

### LibreChat

**Setup:** Add to your `librechat.yaml` configuration:

```yaml
endpoints:
  custom:
    - name: "n8n"
      apiKey: "your-secret-api-key-here"
      baseURL: "http://n8n-openai-bridge:3333/v1"
      models:
        default: ["placeholder-model-do-not-remove-me"]
        fetch: true
      headers:
        X-Chat-Id: "{{LIBRECHAT_BODY_CONVERSATIONID}}"
        X-User-Id: "{{LIBRECHAT_USER_ID}}"
        X-User-Email: "{{LIBRECHAT_USER_EMAIL}}"
        X-User-Name: "{{LIBRECHAT_USER_NAME}}"
        X-User-Role: "{{LIBRECHAT_USER_ROLE}}"
      titleConvo: true
      summary: true
```

**Configuration Notes:**
- `apiKey`: Must match your `BEARER_TOKEN` from `.env`
- `baseURL`: Use `http://n8n-openai-bridge:3333/v1` if running in Docker, or `http://your-server:3333/v1` for external access
- `fetch: true`: Automatically fetches available models from the bridge
- `titleConvo` and `summary`: Enable automatic conversation titling and summarization

**User Context Integration:**

LibreChat provides template variables that can be mapped to custom headers:
- `{{LIBRECHAT_BODY_CONVERSATIONID}}` → `X-Chat-Id` - Session tracking
- `{{LIBRECHAT_USER_ID}}` → `X-User-Id` - User identifier
- `{{LIBRECHAT_USER_EMAIL}}` → `X-User-Email` - User email address
- `{{LIBRECHAT_USER_NAME}}` → `X-User-Name` - User display name
- `{{LIBRECHAT_USER_ROLE}}` → `X-User-Role` - User role (user, admin, etc.)

These headers are automatically recognized by the bridge and forwarded to your n8n workflows, enabling:
- User-specific conversation history
- Role-based response customization
- User activity tracking and analytics
- Personalized AI agent behavior

### JavaScript/TypeScript

```typescript
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: 'your-secret-api-key-here',
  baseURL: 'http://your-server:3333/v1'
});

const response = await openai.chat.completions.create({
  model: 'my-agent',
  messages: [{ role: 'user', content: 'Hello!' }]
});
```

## n8n Workflow Setup

Import [`n8n_workflow.json.example`](n8n_workflow.json.example) in n8n → Configure credentials.

### Required Node Settings

1. **When Chat Message Received** (Chat Trigger)
   - Mode: `Webhook`, Response Mode: `Streaming`, Public: Enabled
   - Copy webhook URL (ends with `/chat`) → Add to `models.json`

2. **AI Agent**
   - Enable Streaming: ✓

3. **Chat Model** (Anthropic, OpenAI, etc.)
   - Configure with your API credentials

4. **Memory Node** (Optional)
   - Use default settings - bridge passes `sessionId` automatically

## Session & User Context Management

### Session Tracking

Sessions are identified from (first found wins):
1. Request body: `session_id`, `conversation_id`, `chat_id`
2. HTTP headers: Configurable via `SESSION_ID_HEADERS`
3. Fallback: Auto-generated UUID

### User Context Forwarding

User information is extracted from (first found wins):
1. HTTP headers: Configurable via `USER_ID_HEADERS`, `USER_EMAIL_HEADERS`, etc.
2. Request body: `user`, `user_id`, `userId`, `user_email`, `userEmail`, etc.
3. Fallback: `userId` defaults to "anonymous", others remain `null`

Example with custom headers:
```bash
curl -X POST http://localhost:3333/v1/chat/completions \
  -H "Authorization: Bearer your-key" \
  -H "X-Session-Id: my-session-123" \
  -H "X-User-Id: user-456" \
  -H "X-User-Email: john@example.com" \
  -H "Content-Type: application/json" \
  -d '{"model": "my-agent", "messages": [...]}'
```

All user context fields are automatically forwarded to your n8n webhook, enabling personalized workflows.

## Testing

Unit tests run in isolated Docker containers with npm caching for fast rebuilds.

```bash
make test              # Run unit tests (~5-10s with cache)
make test-image        # Run Docker image validation tests
make test-load         # Run load tests with k6 (20 users, 1min)
make verify            # Test live API endpoint
```

**Image Tests:** Modular test scenarios validate the production Docker image (build, startup, endpoints, ModelLoader, etc.). Run individual tests: `bash tests/test-image-build.sh invalid-url-validation` or all tests with `make test-image`. See `tests/image-tests/` for available scenarios.

**Load Tests:** Performance testing with k6 simulates concurrent users against a mock n8n backend. Validates streaming/non-streaming responses, authentication, and measures throughput. Results saved to `tests/load/summary.json`.

## Code Quality

This project uses ESLint and Prettier to maintain consistent code style.

```bash
make lint          # Check code quality with ESLint
make lint-fix      # Auto-fix ESLint issues
make format        # Format code with Prettier
make format-check  # Check if code is formatted correctly
```

**Before committing:**
```bash
make lint && make format-check  # Ensure code passes quality checks
```

## Troubleshooting

### Enable detailed logging
```bash
LOG_REQUESTS=true
```

### Check if your models.json is loaded

```bash
# List available models
curl -H "Authorization: Bearer your-token" http://localhost:3333/v1/models

# If you see "docker-default-model" - your mounted models.json is NOT being loaded
# This is the built-in placeholder from the Docker image
# Solution: Check your volume mount path and restart the container
```

### Model Loading Issues

**Symptom:** Server logs show "Error loading models"

**Possible causes:**
- Invalid JSON syntax in models.json
- Models.json is an array instead of an object
- Model URLs are not valid HTTP/HTTPS URLs

**Solution:**
```bash
# Validate JSON syntax
cat models.json | jq .

# Check server logs for specific error
docker logs n8n-openai-bridge 2>&1 | grep "Error loading models"

# Common errors:
# "Models must be an object" → Change [] to {}
# "Invalid webhook URL" → Check URL format (must start with http:// or https://)
```

**Symptom:** Models not reloading after changes

**Possible causes:**
- File is mounted read-only (correct behavior for security)
- File watcher not triggered (requires container restart)

**Solution:**
```bash
# For mounted volumes, restart container to reload
docker restart n8n-openai-bridge

# Or use the reload endpoint
curl -X POST -H "Authorization: Bearer your-token" http://localhost:3333/admin/reload
```

### Common issues

- **"Model not found"**: Check `models.json`
- **Seeing "docker-default-model"**: Your `models.json` mount is not working - check volume path
- **"Unauthorized"**: Verify `BEARER_TOKEN` matches
- **Webhook not responding**: Test webhook directly with `curl`
- **Streaming issues**: Try with `stream: false` first

## Project Structure

```
n8n-openai-bridge/
├── src/
│   ├── server.js          # Express server & OpenAI API endpoints
│   ├── n8nClient.js       # n8n webhook client (streaming & non-streaming)
│   └── config.js          # Configuration & models loader
├── tests/
│   ├── server.test.js     # Server endpoint tests
│   ├── n8nClient.test.js  # n8n client tests
│   └── config.test.js     # Configuration tests
├── docker/
│   ├── Dockerfile.build          # Production Docker image
│   ├── Dockerfile.test           # Test Docker image
│   ├── Dockerfile.mock-n8n       # Mock n8n server for load testing
│   ├── docker-compose.dev.yml    # Development Docker Compose
│   └── docker-compose.loadtest.yml # Load testing Docker Compose
├── models.json            # Model-to-webhook mapping (create from .example)
├── models.json.example    # Example models configuration
├── .env                   # Environment variables (create from .example)
├── .env.example           # Example environment configuration
├── Makefile               # Build and test automation
└── package.json           # Node.js dependencies and scripts
```

## Development

### Feature Branch Workflow

This project uses feature branches and GitHub Actions for CI/CD with **automated releases on merge**.

**Branch naming conventions:**
- `feature/*` - New features
- `fix/*` - Bug fixes
- `hotfix/*` - Urgent production fixes

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

**Automated Releases:**
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

See [.github/workflows/README.md](.github/workflows/README.md) for detailed CI/CD documentation.

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
- Code is properly formatted (`make format-check`)
- Docker build succeeds
- Update documentation as needed

## License

This project is licensed under the **GNU Affero General Public License v3.0 (AGPL-3.0)**.

### What this means:

- ✅ You can use, modify, and distribute this software freely
- ✅ You must share your modifications under the same license
- ✅ If you run a modified version as a web service, you must make the source code available
- ✅ Original author attribution is required

See the [LICENSE](LICENSE) file for full details.

### License History

- **v0.0.7+**: AGPL-3.0 (current)
- **v0.0.1 - v0.0.6**: Apache 2.0 (previous versions remain under Apache 2.0)
