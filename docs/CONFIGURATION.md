# Configuration Guide

Complete guide for configuring n8n OpenAI Bridge.

## Table of Contents

- [Environment Variables](#environment-variables)
- [Model Configuration](#model-configuration)
- [Model Loading System](#model-loading-system)
- [Session Management](#session-management)
- [User Context](#user-context)

## Environment Variables

### Server Configuration

```bash
PORT=3333                        # Server port (default: 3333)
BEARER_TOKEN=your-api-key        # Auth token for API requests TO this bridge
LOG_REQUESTS=false               # Enable detailed request/response logging
DOCKER_NETWORK_NAME=proxy        # Docker network for compose
```

### Authentication

```bash
# Webhook Authentication (bridge → n8n)
N8N_WEBHOOK_BEARER_TOKEN=        # Optional: Auth token for n8n webhooks
```

**Deprecated:**
- `N8N_BEARER_TOKEN` - Use `N8N_WEBHOOK_BEARER_TOKEN` instead (still supported with warning)

### Model Loading Configuration

Select which loader to use and configure loader-specific variables:

```bash
# Loader Selection
MODEL_LOADER_TYPE=file           # Options: file (default), n8n-api, static
```

#### File-based Loader (MODEL_LOADER_TYPE=file)

```bash
MODELS_CONFIG=./models.json      # Path to models JSON file
```

For detailed setup, see [File Loader Documentation](MODELLOADER.md#jsonfilemodelloadertype-file).

#### Auto-Discovery Loader (MODEL_LOADER_TYPE=n8n-api)

```bash
N8N_BASE_URL=https://your-n8n-instance.com
N8N_API_BEARER_TOKEN=n8n_api_xxxxxxxxxxxxx
AUTO_DISCOVERY_TAG=openai-model
AUTO_DISCOVERY_POLLING=300
```

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `N8N_BASE_URL` | Yes | - | Base URL of your n8n instance |
| `N8N_API_BEARER_TOKEN` | Yes | - | n8n API token (Settings > n8n API) |
| `AUTO_DISCOVERY_TAG` | No | `openai-model` | Tag to filter workflows |
| `AUTO_DISCOVERY_POLLING` | No | `300` | Polling interval in seconds (60-600, or 0 to disable) |

For detailed setup, see [Auto-Discovery Loader Documentation](MODELLOADER.md#n8napi-modelloader-type-n8n-api).

#### Static Loader (MODEL_LOADER_TYPE=static)

```bash
STATIC_MODELS={"test-model":"https://n8n.example.com/webhook/test"}
```

For testing and development only. See [Static Loader Documentation](MODELLOADER.md#staticmodelloader-type-static).

### Session & User Context Headers

```bash
# Session & User Context Headers (comma-separated, first found wins)
SESSION_ID_HEADERS=X-Session-Id,X-Chat-Id
USER_ID_HEADERS=X-User-Id
USER_EMAIL_HEADERS=X-User-Email
USER_NAME_HEADERS=X-User-Name
USER_ROLE_HEADERS=X-User-Role
```

See [Session Management](#session-management) and [User Context](#user-context) sections below.

## Model Configuration

Models are loaded via a flexible **ModelLoader system**. The default loader reads from JSON files, but you can switch to auto-discovery via n8n API.

See [MODELLOADER.md](MODELLOADER.md) for complete documentation including:
- Model validation rules
- Error handling and startup behavior
- Migration between loaders
- Troubleshooting guide
- Custom loader development

### Quick Reference

**File-based (Default):**
```bash
MODEL_LOADER_TYPE=file
MODELS_CONFIG=./models.json
```

Models in `models.json` are automatically reloaded when file changes (100ms debounce).

**Auto-Discovery (Recommended):**
```bash
MODEL_LOADER_TYPE=n8n-api
N8N_BASE_URL=https://your-n8n-instance.com
N8N_API_BEARER_TOKEN=n8n_api_xxxxxxxxxxxxx
AUTO_DISCOVERY_TAG=openai-model
AUTO_DISCOVERY_POLLING=300
```

Tag workflows with `openai-model` in n8n UI and they are automatically discovered as models.

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
