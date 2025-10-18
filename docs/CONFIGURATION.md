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

### Authentication Flow

- `BEARER_TOKEN` - Protects this bridge (clients → bridge)
- `N8N_BEARER_TOKEN` - Protects n8n webhooks (bridge → n8n)
- Leave `N8N_BEARER_TOKEN` empty if your n8n webhooks are public

## Model Configuration

### models.json Format

```json
{
  "model-name": "https://n8n.example.com/webhook/abc123/chat"
}
```

### Validation Rules

**Model Configuration Format:**
```json
{
  "model-id": "https://n8n.example.com/webhook/abc123/chat"
}
```

**Model Validation:**
- Models must be a JSON object (not an array)
- Each model URL must be a valid HTTP/HTTPS URL
- Invalid models are logged but don't prevent server startup
- Server starts with empty model list if validation fails

## Model Loading System

The bridge uses a flexible ModelLoader architecture that supports different model sources:

- **JsonFileModelLoader** (default): Loads models from `models.json`
- Hot-reload: Changes to `models.json` are detected automatically (100ms debounce)
- Validation: Models must be an object with valid webhook URLs
- Graceful degradation: Server continues running even if model loading fails

### Hot Reload

Models are automatically reloaded when `models.json` is modified. You can also manually trigger reload:

```bash
curl -X POST -H "Authorization: Bearer your-token" \
  http://localhost:3333/admin/reload
```

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
