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
- Bearer token authentication
- Docker ready with health checks
- Hot-reload models without restart

## Installation

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

### Start with Docker Compose

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

Or manually: `docker-compose up -d`

## Configuration

### Environment Variables (.env)

```bash
PORT=3333                        # Server port
BEARER_TOKEN=your-api-key        # Auth for requests TO this bridge
N8N_BEARER_TOKEN=                # Optional: Auth for requests FROM bridge to n8n
MODELS_CONFIG=./models.json      # Path to models config
LOG_REQUESTS=false               # Debug logging
SESSION_ID_HEADERS=X-Session-Id  # Comma-separated session header names
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
  "userId": "user-identifier"
}
```

**Response format:**
- **Streaming:** JSON chunks with `content`, `text`, `output` or `message` field
- **Non-streaming:** String or JSON with one of the above fields

## API Endpoints

### Health Check
```bash
GET /health
```

### List Models
```bash
GET /v1/models
Authorization: Bearer your-secret-api-key-here
```

### Chat Completion
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

### Reload Models

Models are automatically reloaded when `models.json` is modified. You can also manually trigger a reload:

```bash
POST /admin/reload
Authorization: Bearer your-secret-api-key-here
```

## Integration Examples

### Open WebUI

**Setup:** Settings → Connections → OpenAI API
- API Base URL: `http://your-server:3333/v1`
- API Key: Your `BEARER_TOKEN` from `.env`
- Set `ENABLE_FORWARD_USER_INFO_HEADERS=true` (required for session tracking)

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
      titleConvo: true
      summary: true
```

**Configuration Notes:**
- `apiKey`: Must match your `BEARER_TOKEN` from `.env`
- `baseURL`: Use `http://n8n-openai-bridge:3333/v1` if running in Docker, or `http://your-server:3333/v1` for external access
- `fetch: true`: Automatically fetches available models from the bridge
- `X-Chat-Id` header: Passes LibreChat's conversation ID to the bridge for session tracking
- `titleConvo` and `summary`: Enable automatic conversation titling and summarization

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

## Session Management

Sessions are identified from (first found wins):
1. Request body: `session_id`, `conversation_id`, `chat_id`
2. HTTP headers: Configurable via `SESSION_ID_HEADERS`
3. Fallback: Auto-generated UUID

Example with custom header:
```bash
curl -X POST http://localhost:3333/v1/chat/completions \
  -H "Authorization: Bearer your-key" \
  -H "X-Session-Id: my-session-123" \
  -H "Content-Type: application/json" \
  -d '{"model": "my-agent", "messages": [...]}'
```

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

### Common issues

- **"Model not found"**: Check `models.json`
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
├── models.json            # Model-to-webhook mapping (create from .example)
├── models.json.example    # Example models configuration
├── .env                   # Environment variables (create from .example)
├── .env.example           # Example environment configuration
├── Dockerfile             # Production Docker image
├── Dockerfile.test        # Test Docker image
├── docker-compose.yml     # Docker Compose configuration
├── Makefile               # Build and test automation
└── package.json           # Node.js dependencies and scripts
```

## License

Apache 2.0
