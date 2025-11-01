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
REQUEST_BODY_LIMIT=50mb          # Maximum size for JSON request bodies (default: 50mb)
DOCKER_NETWORK_NAME=proxy        # Docker network for compose
```

### Request Body Size Limit

```bash
REQUEST_BODY_LIMIT=50mb          # Maximum size for JSON request bodies (default: 50mb)
```

Controls the maximum size of incoming JSON request bodies. This is particularly important when handling:
- Base64-encoded images in vision API requests
- Large file uploads embedded in JSON
- Extensive chat histories

**Supported formats:**
- `100kb` - 100 kilobytes
- `1mb` - 1 megabyte
- `50mb` - 50 megabytes (default)
- `100mb` - 100 megabytes

**Recommendations:**
- **Default (50mb)**: Suitable for most use cases including image uploads
- **Increase to 100mb+**: If handling multiple large images or extensive data
- **Decrease to 10mb**: If you want to restrict payload sizes for security

**Note:** Large payloads may impact performance and memory usage. Monitor your server resources when increasing this limit.

### Authentication

```bash
# API Authentication (clients → bridge)
BEARER_TOKEN=your-api-key        # Required: Auth token for API requests TO this bridge

# Webhook Authentication (bridge → n8n)
N8N_WEBHOOK_BEARER_TOKEN=        # Optional: Auth token for n8n webhook nodes
```

#### N8N_WEBHOOK_BEARER_TOKEN (Optional)

Secures communication between the bridge and n8n Webhook nodes using Bearer token authentication.

**Use Case:** When using n8n Webhook nodes (not Chat Trigger nodes), you can protect your webhooks from unauthorized access.

**Requirements:**
- Only works with **Webhook nodes** in n8n
- Does NOT work with Chat Trigger nodes
- Requires **Header Auth credential** in n8n with:
  - Header Name: `Authorization`
  - Header Value: `Bearer <your-token>`

**Setup Steps:**

1. Set the token in your bridge configuration:
   ```bash
   N8N_WEBHOOK_BEARER_TOKEN=your-secure-webhook-token-here
   ```

2. Create a Header Auth credential in n8n:
   - Go to: Credentials → Create New Credential
   - Type: `Header Auth`
   - Header Name: `Authorization`
   - Header Value: `Bearer your-secure-webhook-token-here`
   - Save the credential

3. Attach the credential to your Webhook node:
   - Open your Webhook node
   - Expand "Authentication"
   - Enable: `Header Auth`
   - Select: The credential you created

See [n8n Workflow Setup - Webhook Authentication](N8N_SETUP.md#webhook-authentication-optional) for detailed instructions.

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
MODELS_CONFIG_FILE=./models.json    # Path to models JSON file
MODELS_POLL_INTERVAL=1              # File polling interval in seconds (default: 1)
```

**Deprecated:**
- `MODELS_CONFIG` - Use `MODELS_CONFIG_FILE` instead (still supported with warning)

For detailed setup, see [File Loader Documentation](MODELLOADER.md#jsonfilemodelloadertype-file).

#### Auto-Discovery Loader (MODEL_LOADER_TYPE=n8n-api)

```bash
N8N_BASE_URL=https://your-n8n-instance.com
N8N_API_BEARER_TOKEN=n8n_api_xxxxxxxxxxxxx
AUTO_DISCOVERY_TAG=n8n-openai-bridge
AUTO_DISCOVERY_POLL_INTERVAL=300
```

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `N8N_BASE_URL` | Yes | - | Base URL of your n8n instance |
| `N8N_API_BEARER_TOKEN` | Yes | - | n8n API token (Settings > n8n API) |
| `AUTO_DISCOVERY_TAG` | No | `n8n-openai-bridge` | Tag to filter workflows |
| `AUTO_DISCOVERY_POLL_INTERVAL` | No | `300` | Polling interval in seconds (60-600, or 0 to disable) |

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

### Task Detection

Automatically detect if incoming requests are automated task generation requests from OpenWebUI, LibreChat, or similar clients:

```bash
# Task Detection Configuration
ENABLE_TASK_DETECTION=false      # Set to 'true' to enable (default: false)
```

**What it does:**
- Analyzes incoming chat completion requests to detect automated tasks
- Adds `isTask` and `taskType` fields to the n8n webhook payload
- Helps differentiate between regular user messages and automated generation tasks

**Supported Task Types:**
- `generate_title` - Title generation (OpenWebUI, LibreChat)
- `generate_tags` - Tags generation (OpenWebUI)
- `generate_follow_up_questions` - Follow-up questions (OpenWebUI)

**Task Detection Fields Added to Payload:**

Normal conversation:
```json
{
  "isTask": false,
  "taskType": null
}
```

Title generation detected:
```json
{
  "isTask": true,
  "taskType": "generate_title"
}
```

Tags generation detected:
```json
{
  "isTask": true,
  "taskType": "generate_tags"
}
```

Follow-up questions detected:
```json
{
  "isTask": true,
  "taskType": "generate_follow_up_questions"
}
```

**Use Cases:**
- Route tasks to different AI agents (use faster/cheaper models for tasks)
- Separate memory storage for tasks vs. conversations
- Apply different system prompts for automated tasks
- Track and analyze automated vs. manual interactions

**See Also:**
- [How To: Use Task Detection in n8n Workflows](howto/TASK_DETECTION.md) - Practical examples with IF nodes and memory separation

### Webhook Notifier

Get notified via webhook when models change (hot-reload or auto-discovery):

```bash
# Webhook Notifier Configuration (optional)
WEBHOOK_NOTIFIER_URL=https://your-service.com/webhook/model-changes
WEBHOOK_NOTIFIER_TIMEOUT=5000           # Request timeout in milliseconds (default: 5000)
WEBHOOK_NOTIFIER_RETRIES=3              # Maximum retry attempts (default: 3)
WEBHOOK_NOTIFIER_BEARER_TOKEN=          # Optional: Bearer token for webhook authentication
WEBHOOK_NOTIFIER_ON_STARTUP=false       # Notify webhook on server startup (default: false)
```

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `WEBHOOK_NOTIFIER_URL` | No | - | Webhook URL to notify on model changes. Feature disabled if not set. |
| `WEBHOOK_NOTIFIER_TIMEOUT` | No | `5000` | HTTP request timeout in milliseconds |
| `WEBHOOK_NOTIFIER_RETRIES` | No | `3` | Maximum retry attempts with exponential backoff (1s, 2s, 4s) |
| `WEBHOOK_NOTIFIER_BEARER_TOKEN` | No | - | Optional Bearer token for webhook authentication |
| `WEBHOOK_NOTIFIER_ON_STARTUP` | No | `false` | Send notification when server starts and models are loaded |

**How it works:**
- Only triggers for loaders that implement `watch()` (JsonFileModelLoader, N8nApiModelLoader)
- Notifications sent only when models actually change (hash-based detection)
- Uses exponential backoff retry strategy (1s, 2s, 4s intervals)
- Failures are logged but never block model loading (graceful degradation)

**Webhook Payload Format:**

When models change (hot-reload or auto-discovery):
```json
{
  "type": "models_changed",
  "timestamp": "2025-10-25T10:30:00.000Z",
  "source": "JsonFileModelLoader",
  "models": {
    "chat-trigger-agent": "https://n8n.example.com/webhook/abc123/chat",
    "webhook-agent": "https://n8n.example.com/webhook/xyz789"
  },
  "modelCount": 2
}
```

When server starts (only if `WEBHOOK_NOTIFIER_ON_STARTUP=true`):
```json
{
  "type": "models_loaded",
  "timestamp": "2025-10-25T10:25:00.000Z",
  "source": "N8nApiModelLoader",
  "models": {
    "chat-trigger-agent": "https://n8n.example.com/webhook/abc123/chat",
    "webhook-agent": "https://n8n.example.com/webhook/xyz789"
  },
  "modelCount": 2
}
```

**Use Cases:**
- Invalidate frontend caches when models change
- Update monitoring dashboards with available models
- Trigger automated tests when new models are deployed
- Send alerts to Slack/Discord when models are updated

## Model Configuration

Models are loaded via a flexible **ModelLoader system** managed by the `ModelRepository`. The repository maintains model state in memory while loaders handle data sources (files, APIs, etc.).

**Architecture:**
- `Config` (src/config/Config.js) - Parses ENV variables, server settings
- `ModelRepository` (src/repositories/ModelRepository.js) - Manages model state, queries, reloading
- `ModelLoaderFactory` (src/factories/ModelLoaderFactory.js) - Creates appropriate loader based on `MODEL_LOADER_TYPE`
- `Bootstrap` (src/Bootstrap.js) - Orchestrates lifecycle, wires dependencies

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
AUTO_DISCOVERY_TAG=n8n-openai-bridge
AUTO_DISCOVERY_POLL_INTERVAL=300
```

Tag workflows with `n8n-openai-bridge` in n8n UI and they are automatically discovered as models.

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
