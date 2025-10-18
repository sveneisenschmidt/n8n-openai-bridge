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
- Test coverage with 198 unit tests
- **Advanced: Auto-Discovery (experimental)** - Automatically discover n8n workflows as models via tags

## Quick Start

### 1. Create models.json

Map your n8n workflow webhooks to model names:

```json
{
  "gpt-4-agent": "https://n8n.yourdomain.com/webhook/abc123/chat",
  "claude-support": "https://n8n.yourdomain.com/webhook/def456/chat",
  "custom-agent": "https://n8n.yourdomain.com/webhook/xyz789/chat"
}
```

### 2. Configure Environment

Create `.env` file:

```bash
PORT=3333
BEARER_TOKEN=your-secret-api-key
N8N_WEBHOOK_BEARER_TOKEN=your-n8n-webhook-token  # Optional
MODELS_CONFIG=./models.json
LOG_REQUESTS=false
```

### 3. Start the Bridge

**Docker:**
```bash
docker run -d \
  --name n8n-openai-bridge \
  -p 3333:3333 \
  -v $(pwd)/models.json:/app/models.json \
  -e BEARER_TOKEN=your-secret-api-key \
  ghcr.io/sveneisenschmidt/n8n-openai-bridge:latest
```

**Local:**
```bash
npm install
npm start
```

### 4. Use in OpenAI Clients

Your models are now available at `http://localhost:3333/v1/chat/completions`

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

**Docker Compose (Manual models.json):**

```yaml
services:
  n8n-openai-bridge:
    image: ghcr.io/sveneisenschmidt/n8n-openai-bridge:latest
    container_name: n8n-openai-bridge
    ports:
      - "3333:3333"
    environment:
      - BEARER_TOKEN=your-secret-api-key-here
      - N8N_WEBHOOK_BEARER_TOKEN=  # Optional: for authenticated n8n webhooks
      - LOG_REQUESTS=false
      - SESSION_ID_HEADERS=X-Session-Id,X-Chat-Id,X-OpenWebUI-Chat-Id
    volumes:
      - ./models.json:/app/models.json:ro
    restart: unless-stopped
```

**Docker Compose (Auto-Discovery):**

```yaml
services:
  n8n-openai-bridge:
    image: ghcr.io/sveneisenschmidt/n8n-openai-bridge:latest
    container_name: n8n-openai-bridge
    ports:
      - "3333:3333"
    environment:
      - BEARER_TOKEN=your-secret-api-key-here
      - N8N_API_URL=https://n8n.yourdomain.com
      - N8N_API_BEARER_TOKEN=your-n8n-api-token
      - N8N_WEBHOOK_BASE_URL=https://n8n.yourdomain.com
      - N8N_WEBHOOK_BEARER_TOKEN=  # Optional: for authenticated webhooks
      - AUTO_FETCH_MODELS_BY_TAG=true
      - AUTO_DISCOVERY_TAG=n8n-openai-model
      - AUTO_DISCOVERY_POLLING=300
      - LOG_REQUESTS=false
      - SESSION_ID_HEADERS=X-Session-Id,X-Chat-Id,X-OpenWebUI-Chat-Id
    restart: unless-stopped
```

**Available image tags:**
- `latest` - Latest stable release
- `0.0.3` - Specific version
- `0.0` - Latest patch version of 0.0.x
- `0` - Latest minor version of 0.x.x

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
PORT=3333                             # Server port
BEARER_TOKEN=your-api-key             # Auth for requests TO this bridge
N8N_WEBHOOK_BEARER_TOKEN=             # Optional: Auth for webhook requests (bridge → n8n)
N8N_API_BEARER_TOKEN=                 # Optional: Auth for n8n API (auto-discovery)
MODELS_CONFIG=./models.json           # Path to models config
LOG_REQUESTS=false                    # Debug logging

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
- `N8N_WEBHOOK_BEARER_TOKEN` - Protects n8n webhooks (bridge → n8n)
- `N8N_API_BEARER_TOKEN` - Authenticates with n8n API (for auto-discovery)
- Leave these empty if your n8n webhooks/API are public

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
   - Enable Streaming: OK

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

## Advanced: Auto-Discovery (Experimental)

**Note:** Auto-Discovery is an experimental opt-in feature for automatically discovering n8n workflows as models.

### Overview

Instead of manually maintaining `models.json`, the bridge can automatically discover your n8n workflows by tag and expose them as OpenAI models.

### Quick Start

1. **Tag your n8n workflows** with `n8n-openai-model`
2. **Configure environment variables:**

```bash
AUTO_FETCH_MODELS_BY_TAG=true
AUTO_DISCOVERY_TAG=n8n-openai-model
AUTO_DISCOVERY_POLLING=300

N8N_API_URL=https://n8n.yourdomain.com
N8N_API_BEARER_TOKEN=your-n8n-api-token
N8N_WEBHOOK_BASE_URL=https://n8n.yourdomain.com  # Optional, if different from API URL
```

3. **Start the bridge** - Models are discovered automatically!

### How It Works

```
┌─────────────────────────────────────────┐
│  1. Bridge starts & discovers workflows │
│     Tagged with 'n8n-openai-model'      │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  2. Extract webhook URLs from nodes     │
│     Write to models.json (cache)        │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  3. Periodic polling (every 5 minutes)  │
│     Auto-update on workflow changes     │
└─────────────────────────────────────────┘
```

### Configuration

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `AUTO_FETCH_MODELS_BY_TAG` | boolean | `false` | Enable auto-discovery |
| `AUTO_DISCOVERY_TAG` | string | `n8n-openai-model` | Tag to identify workflows |
| `AUTO_DISCOVERY_POLLING` | number | `300` | Polling interval in seconds (60-600, 0=disabled) |
| `N8N_API_URL` | string | - | n8n API base URL (e.g., `https://n8n.domain.com`) |
| `N8N_API_BEARER_TOKEN` | string | - | n8n API token (WARNING full access) |
| `N8N_WEBHOOK_BASE_URL` | string | `N8N_API_URL` | Webhook base URL if different from API URL |
| `N8N_WEBHOOK_BEARER_TOKEN` | string | - | Token for webhook calls (optional) |

### Workflow Requirements

Your n8n workflows must:
- OK Be tagged with the discovery tag (default: `n8n-openai-model`)
- OK Contain at least one **Webhook node**
- WARNING Inactive workflows trigger a warning but are still added

### Model Naming

- **Model ID** = Workflow Name (as shown in n8n)
- **Webhook URL** = Extracted from webhook node configuration

Example:
```
n8n Workflow: "GPT-4 Customer Support Agent"
→ Model ID: "GPT-4 Customer Support Agent"
→ Available in OpenAI clients as this model name
```

**Important:** If multiple workflows have the same name, only the last discovered workflow will be available (last-wins behavior). Ensure your workflow names are unique.

### Admin Endpoints

**Trigger Manual Discovery:**
```bash
curl -X POST http://localhost:3333/admin/models-discover \
  -H "Authorization: Bearer your-secret-api-key"
```

Response:
```json
{
  "status": "ok",
  "message": "Discovery completed",
  "discovered": 5,
  "added": 3,
  "skipped": 2,
  "warnings": [
    "Workflow 'Test' (ID: abc-123) is INACTIVE but added to models"
  ],
  "models": 3
}
```

**Reload from Disk:**
```bash
curl -X POST http://localhost:3333/admin/models-reload \
  -H "Authorization: Bearer your-secret-api-key"
```

### Logging & Debugging

Auto-discovery logs are written at startup and during each polling cycle:

```
[2025-01-15T10:00:00Z] Auto-Discovery: Starting...
[2025-01-15T10:00:00Z] Auto-Discovery: Found 5 workflows with tag 'n8n-openai-model'
[2025-01-15T10:00:00Z] Auto-Discovery: Complete - 3 added, 2 skipped, 1 warnings
[2025-01-15T10:00:00Z] WARNING: Workflow 'Test' (ID: abc-123) is INACTIVE but added to models
```

**Inspect discovered models:**
```bash
# Docker
docker exec -it n8n-openai-bridge cat models.json

# Local
cat models.json
```

### Error Handling

- **n8n API unreachable at startup:** Falls back to existing `models.json`, retries after polling interval
- **API errors during polling:** Keeps last successful model list
- **3 consecutive failures:** Exponential backoff (up to 10 minutes)
- **Workflow without webhook:** Skipped with detailed warning log

### Backwards Compatibility

When `AUTO_FETCH_MODELS_BY_TAG=false`, the bridge works exactly as before:
- Manual `models.json` management
- File-watch for hot-reload
- No n8n API calls

### Migration Notes

**Deprecated:**
- `N8N_BEARER_TOKEN` → Use `N8N_WEBHOOK_BEARER_TOKEN` instead
- A warning is displayed at startup if using the deprecated variable

**New Token Types:**
- `N8N_WEBHOOK_BEARER_TOKEN` - For webhook authentication (optional)
- `N8N_API_BEARER_TOKEN` - For n8n API access (required for auto-discovery, WARNING has full access)

## Testing

Unit tests run in isolated Docker containers with npm caching for fast rebuilds.

```bash
make test         # Run tests (always uses latest code, ~5-10s with cache)
make verify       # Test live API endpoint
```

Tests cover configuration, n8n client, and API endpoints. See `tests/` directory.

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
- All tests pass (`npm test`)
- Docker build succeeds
- Code follows existing style
- Update documentation as needed

## License

This project is licensed under the **GNU Affero General Public License v3.0 (AGPL-3.0)**.

### What this means:

- OK You can use, modify, and distribute this software freely
- OK You must share your modifications under the same license
- OK If you run a modified version as a web service, you must make the source code available
- OK Original author attribution is required

See the [LICENSE](LICENSE) file for full details.

### License History

- **v0.0.7+**: AGPL-3.0 (current)
- **v0.0.1 - v0.0.6**: Apache 2.0 (previous versions remain under Apache 2.0)
