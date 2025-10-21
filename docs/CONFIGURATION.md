# Configuration Guide

Complete guide for configuring n8n OpenAI Bridge.

## Table of Contents

- [Environment Variables](#environment-variables)
- [Model Configuration](#model-configuration)
- [Model Loading System](#model-loading-system)
- [Session Management](#session-management)
- [User Context](#user-context)

## Environment Variables

### .env Configuration

```bash
# Server Configuration
PORT=3333                        # Server port
BEARER_TOKEN=your-api-key        # Auth for requests TO this bridge
N8N_WEBHOOK_BEARER_TOKEN=        # Optional: Auth for requests FROM bridge to n8n
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

### Authentication Flow

- `BEARER_TOKEN` - Protects this bridge (clients → bridge)
- `N8N_WEBHOOK_BEARER_TOKEN` - Protects n8n webhooks (bridge → n8n)
- Leave `N8N_WEBHOOK_BEARER_TOKEN` empty if your n8n webhooks are public

**Backwards Compatibility:**
The deprecated `N8N_BEARER_TOKEN` variable is still supported but will show a deprecation warning. Please migrate to `N8N_WEBHOOK_BEARER_TOKEN`.

## Model Configuration

Models are loaded via a **ModelLoader** system that abstracts the model source. The bridge includes a built-in **JsonFileModelLoader** for loading models from JSON files.

### Built-in: JsonFileModelLoader

The default model loader reads from a JSON file (configured via `MODELS_CONFIG`).

#### File Format

`models.json`:
```json
{
  "model-id": "https://n8n.example.com/webhook/abc123/chat",
  "gpt-4": "https://n8n.example.com/webhook/gpt4/chat"
}
```

#### How It Works

**Startup:**
- Reads `models.json` synchronously
- Validates each model (ID must be non-empty string, URL must be valid HTTP/HTTPS)
- Invalid models filtered out with warnings
- Throws error if: file not found OR invalid JSON syntax

**Hot-Reload:**
- Watches `models.json` for changes via file system events
- 100ms debounce prevents reload storms from multiple file events
- Reloads and validates on file change
- Invalid reload attempts keep old models, error logged
- Can be manually triggered: `curl -X POST -H "Authorization: Bearer token" http://localhost:3333/admin/reload`

**Error Handling:**
- Invalid model entries → Skipped with warning, server continues with valid models
- File not found → Error thrown, blocks startup
- Invalid JSON → Error thrown with details, blocks startup
- Watch setup failure → Warning logged, server runs without hot-reload

For detailed documentation including troubleshooting and architecture, see [MODELLOADER.md](MODELLOADER.md).

## Session Management

### Session ID Detection

Sessions are identified from (first found wins):

1. Request body: `session_id`, `conversation_id`, `chat_id`
2. HTTP headers: Configurable via `SESSION_ID_HEADERS`
3. Fallback: Auto-generated UUID

### Configuration

```bash
# Configure which headers to check for session ID
SESSION_ID_HEADERS=X-Session-Id,X-Chat-Id,X-OpenWebUI-Chat-Id
```

## User Context

### Available Fields

- `userId` - User identifier (required, defaults to "anonymous")
- `userEmail` - User email address (optional)
- `userName` - User display name (optional)
- `userRole` - User role/permission level (optional)

### Detection Priority

User information is extracted from (first found wins):

1. HTTP headers: Configurable via `USER_ID_HEADERS`, `USER_EMAIL_HEADERS`, etc.
2. Request body: `user`, `user_id`, `userId`, `user_email`, `userEmail`, etc.
3. Fallback: `userId` defaults to "anonymous", others remain `null`

### Configuration

```bash
USER_ID_HEADERS=X-User-Id,X-OpenWebUI-User-Id
USER_EMAIL_HEADERS=X-User-Email,X-OpenWebUI-User-Email
USER_NAME_HEADERS=X-User-Name,X-OpenWebUI-User-Name
USER_ROLE_HEADERS=X-User-Role,X-OpenWebUI-User-Role
```

### n8n Webhook Payload

All user context is automatically forwarded to your n8n webhook:

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

## Next Steps

- [Learn API usage](USAGE.md)
- [Set up n8n workflow](N8N_SETUP.md)
- [Integrate with clients](INTEGRATIONS.md)
