# Model Loader Architecture

The bridge uses a flexible **ModelLoader architecture** to load models from different sources via `MODEL_LOADER_TYPE` environment variable.

## Available Loaders

### JsonFileModelLoader (Type: `file`)

Default loader. Reads models from a JSON file with automatic hot-reload.

**Configuration:**
```bash
MODEL_LOADER_TYPE=file
MODELS_CONFIG=./models.json
```

**File Format:**
```json
{
  "model-id": "https://n8n.example.com/webhook/abc123/chat",
  "gpt-4": "https://n8n.example.com/webhook/gpt4/chat"
}
```

**Behavior:**
- Startup: Reads file synchronously, throws if not found or invalid JSON
- Hot-reload: Watches file (100ms debounce), reloads on changes
- Invalid models: Filtered out with warnings, server continues
- Watch failure: Logged as warning, server runs without auto-reload

**Validation:**
- Model ID: Non-empty string
- Webhook URL: Valid HTTP/HTTPS URL
- Invalid entries skipped with warning

### N8nApiModelLoader (Type: `n8n-api`)

Auto-discovers n8n workflows as OpenAI models. Workflows tagged with a specific tag are automatically discovered and exposed.

**Configuration:**
```bash
MODEL_LOADER_TYPE=n8n-api
N8N_BASE_URL=https://your-n8n-instance.com
N8N_API_BEARER_TOKEN=n8n_api_xxxxxxxxxxxxx
AUTO_DISCOVERY_TAG=n8n-openai-bridge
AUTO_DISCOVERY_POLLING=300
```

**Environment Variables:**

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `N8N_BASE_URL` | Yes | - | Base URL of n8n instance |
| `N8N_API_BEARER_TOKEN` | Yes | - | n8n API token (from Settings > n8n API) |
| `AUTO_DISCOVERY_TAG` | No | `n8n-openai-bridge` | Tag to filter workflows |
| `AUTO_DISCOVERY_POLLING` | No | `300` | Polling interval in seconds (60-600, or 0 to disable) |

**How It Works:**
1. Fetches workflows from n8n API
2. Filters by `AUTO_DISCOVERY_TAG` tag (default: `n8n-openai-bridge`)
3. Only active workflows are exposed
4. Extracts webhook URL from first webhook node
5. Generates model ID from workflow name (or `model:custom-id` tag if present)

**Model ID Generation:**
- Priority 1: Custom tag `model:custom-id` → use `custom-id`
- Priority 2: Workflow name → sanitize and lowercase (e.g., "GPT-4 Agent" → `gpt-4-agent`)
- Priority 3: Workflow ID (fallback)

**Setup Steps:**
1. Create n8n API key: Settings > n8n API > Create API Key
2. Tag workflows: Add `n8n-openai-bridge` tag to workflows you want exposed
3. Optionally add `model:custom-id` tag for custom model IDs
4. Mark workflows as Active in n8n
5. Configure bridge with environment variables
6. Restart bridge

**Polling:**
- Runs at startup, then at configured interval
- On failure: Logs error, keeps existing models, retries later
- Disabled when `AUTO_DISCOVERY_POLLING=0`

**Security:**
- API token has read/write access to n8n
- Never commit token to git
- Webhook URLs are public (use `N8N_WEBHOOK_BEARER_TOKEN` for webhook auth)

### StaticModelLoader (Type: `static`)

Loads models from environment variable. For testing and development only.

**Configuration:**
```bash
MODEL_LOADER_TYPE=static
STATIC_MODELS={"test-model":"https://n8n.example.com/webhook/test"}
```

---

## Validation Rules

Applied to all models from any loader:

1. **Root**: Must be a plain object (not array)
2. **Model ID**: Non-empty string
3. **Webhook URL**: Valid HTTP/HTTPS URL

Invalid entries are filtered out with warnings. Server continues with valid models.

**Example:**
```json
{
  "valid": "https://example.com/hook",
  "": "https://example.com/hook",
  "bad": "not-a-url"
}
```
Result: Only `"valid"` is loaded. Warnings logged for invalid entries.

---

## Error Handling

### Startup Errors (Block Server)

These prevent the server from starting:

**JsonFileModelLoader:**
- File not found
- Invalid JSON syntax

**N8nApiModelLoader:**
- n8n API unreachable
- Invalid API token (401)
- API timeout
- Invalid JSON response

**StaticModelLoader:**
- Invalid JSON in `STATIC_MODELS`

### Runtime Warnings (Server Continues)

These are logged as warnings but don't block startup:

**All loaders:**
- Invalid model entries (filtered out)

**JsonFileModelLoader:**
- File watcher setup failure (but file still loads)

**N8nApiModelLoader:**
- Inactive workflows (skipped)
- Polling failures (retried later)

---

## Comparison

| Feature | JsonFileModelLoader | N8nApiModelLoader | StaticModelLoader |
|---------|-------------------|-------------------|-------------------|
| **Type ID** | `file` | `n8n-api` | `static` |
| **Use Case** | Manual configuration | Auto-discovery | Testing only |
| **Startup Speed** | Fast | Depends on API | Fast |
| **Hot-Reload** | File watching | Polling | None |
| **Dependencies** | None | n8n API access | None |

---

## API Endpoints

### GET /v1/models

Lists all currently loaded models (all loaders).

**Response:**
```json
{
  "object": "list",
  "data": [
    {"id": "model-id", "object": "model", "owned_by": "organization"}
  ]
}
```

### POST /admin/reload

Manually reload models. Requires `BEARER_TOKEN`.

**Response:**
```json
{
  "status": "success",
  "models_loaded": 3
}
```

---

## Troubleshooting

| Problem | Cause | Solution |
|---------|-------|----------|
| "File not found" error | `models.json` missing | Create file or check `MODELS_CONFIG` path |
| "Invalid JSON" error | Syntax error in `models.json` | Validate with `cat models.json \| jq` |
| "No models discovered" | No workflows tagged | Tag workflows in n8n with `n8n-openai-bridge` tag |
| "Invalid token" (401) | Token invalid/expired | Regenerate in n8n Settings > n8n API |
| Models don't update | Polling disabled | Check `AUTO_DISCOVERY_POLLING` value (0 disables) |
| Inactive workflows shown | Check workflow status | Only active workflows are exposed |

---

## Migration: File to Auto-Discovery

**Before:**
```bash
MODEL_LOADER_TYPE=file
MODELS_CONFIG=./models.json
```

**After:**
```bash
MODEL_LOADER_TYPE=n8n-api
N8N_BASE_URL=https://your-n8n.com
N8N_API_BEARER_TOKEN=n8n_api_xxxxxxxxxxxxx
AUTO_DISCOVERY_TAG=openai-model
```

**Rollback:** Switch `MODEL_LOADER_TYPE` back to `file`. Your `models.json` is not affected.

---

## Code References

- **Base Class**: `src/loaders/ModelLoader.js`
- **File Loader**: `src/loaders/JsonFileModelLoader.js`
- **n8n API Loader**: `src/loaders/N8nApiModelLoader.js`
- **Static Loader**: `src/loaders/StaticModelLoader.js`
- **Config Integration**: `src/config.js`
- **Tests**: `tests/loaders/`

---

## Related Documentation

- **[Configuration Guide](CONFIGURATION.md)** - All environment variables
- **[n8n Setup Guide](N8N_SETUP.md)** - Configure n8n workflows
- **[Troubleshooting](TROUBLESHOOTING.md)** - Common issues
