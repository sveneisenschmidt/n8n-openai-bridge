# Model Loader Architecture

The bridge uses a flexible **ModelLoader architecture** to load models from different sources via `MODEL_LOADER_TYPE` environment variable.

## Available Loaders

### JsonFileModelLoader (Type: `file`)

Default loader. Reads models from a JSON file with automatic hot-reload via hash-based polling.

**Configuration:**
```bash
MODEL_LOADER_TYPE=file
MODELS_CONFIG_FILE=./models.json    # Path to models JSON file
MODELS_POLL_INTERVAL=1              # Polling interval in seconds (default: 1)
```

**Deprecated:**
- `MODELS_CONFIG` - Use `MODELS_CONFIG_FILE` instead (still supported with warning)

**File Format:**
```json
{
  "chat-trigger-agent": "https://n8n.example.com/webhook/abc123/chat",
  "webhook-agent": "https://n8n.example.com/webhook/xyz789"
}
```

**Note:** 
- Chat Trigger nodes: URLs end with `/chat`
- Webhook nodes: URLs without `/chat` suffix

**Behavior:**
- Startup: Reads file synchronously, throws if not found or invalid JSON
- Hot-reload: Polls file and compares model hash, reloads only when models change
- Polling interval: Configurable via `MODELS_POLL_INTERVAL` in seconds (default: 1s, no upper limit for local files)
- Invalid models: Filtered out with warnings, server continues
- Hash comparison: Only reloads when model content actually changed (not formatting/whitespace)

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
AUTO_DISCOVERY_POLL_INTERVAL=300
```

**Environment Variables:**

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `N8N_BASE_URL` | Yes | - | Base URL of n8n instance |
| `N8N_API_BEARER_TOKEN` | Yes | - | n8n API token (from Settings > n8n API) |
| `AUTO_DISCOVERY_TAG` | No | `n8n-openai-bridge` | Tag to filter workflows |
| `AUTO_DISCOVERY_POLL_INTERVAL` | No | `300` | Polling interval in seconds (60-600, or 0 to disable) |

**How It Works:**
1. Fetches workflows from n8n API
2. Filters by `AUTO_DISCOVERY_TAG` tag (default: `n8n-openai-bridge`)
3. Only active workflows are exposed
4. Extracts webhook URL from chatTrigger node (`@n8n/n8n-nodes-langchain.chatTrigger`)
5. Generates model ID from original workflow name (no sanitization)

**Model ID Generation:**
- Workflow name (exactly as named in n8n): `"GPT-4 Agent"` → `"GPT-4 Agent"`
- Workflow ID used as fallback if name is empty
- No sanitization or transformation

**Setup Steps:**
1. Create n8n API key: Settings > n8n API > Create API Key
2. Create workflow with chatTrigger node (required for webhook extraction)
3. Tag workflow: Add `n8n-openai-bridge` tag to workflows you want exposed
4. Mark workflows as Active in n8n
5. Configure bridge with environment variables
6. Restart bridge

**Polling:**
- Runs at startup, then at configured interval
- Hash comparison: Only fires callbacks when models actually change
- On failure: Logs error, keeps existing models, retries later
- Disabled when `AUTO_DISCOVERY_POLL_INTERVAL=0`

**Security:**
- API token has read/write access to n8n
- Never commit token to git
- Webhook URLs are public (use `N8N_WEBHOOK_BEARER_TOKEN` for webhook auth)

### JsonHttpModelLoader (Type: `json-http`)

Fetches models from any HTTP(S) endpoint that returns JSON. No authentication required (basic support, future enhancements possible).

**Configuration:**
```bash
MODEL_LOADER_TYPE=json-http
JSON_HTTP_ENDPOINT=https://api.example.com/models
JSON_HTTP_POLL_INTERVAL=300
JSON_HTTP_TIMEOUT=10000
```

**Environment Variables:**

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `JSON_HTTP_ENDPOINT` | Yes | - | HTTP(S) endpoint URL that returns JSON models |
| `JSON_HTTP_POLL_INTERVAL` | No | `300` | Polling interval in seconds (0=disabled, 60-600 range) |
| `JSON_HTTP_TIMEOUT` | No | `10000` | HTTP request timeout in milliseconds (min: 1000) |

**Expected Response Format:**
```json
{
  "model-id-1": "https://webhook.example.com/path1",
  "model-id-2": "https://webhook.example.com/path2"
}
```

**How It Works:**
1. Fetches JSON from configured HTTP endpoint
2. Validates response is a JSON object (not array or primitive)
3. Validates each model entry (graceful degradation)
4. Optional: Polls for changes at configured interval
5. Hash-based change detection (only fires callbacks on actual changes)

**Use Cases:**
- Centralized model configuration service
- Dynamic model provisioning
- Third-party model registries
- Multi-tenant model discovery

**Polling:**
- Runs at startup, then at configured interval
- Hash comparison: Only fires callbacks when models actually change
- On failure: Logs error, keeps existing models, retries later
- Disabled when `JSON_HTTP_POLL_INTERVAL=0`

**Setup Steps:**
1. Create HTTP endpoint that returns JSON object with model mappings
2. Configure bridge with endpoint URL
3. Set polling interval (optional)
4. Set timeout if endpoint is slow (optional)
5. Restart bridge

**Error Handling:**
- HTTP errors (401, 403, 404, 5xx): Detailed error messages
- Network errors: Clear failure messages with endpoint URL
- Invalid JSON format: Throws during startup
- Invalid model entries: Filtered with warnings (graceful degradation)

**Security Considerations:**
- Endpoint should be HTTPS in production
- Future versions will support authentication (bearer tokens, custom headers)
- Webhook URLs in response should be HTTPS
- Consider using VPN/private network for internal endpoints

**Example Endpoint Response:**
```json
{
  "gpt-4": "https://n8n.company.com/webhook/gpt4-chat/chat",
  "claude-3": "https://n8n.company.com/webhook/claude/chat",
  "local-model": "https://ollama.local:8000/webhook/ollama"
}
```

**Example n8n Workflow:**

See [n8n-examples/n8n_workflow_http_loader.json](../n8n-examples/n8n_workflow_http_loader.json) for a complete workflow example that returns model configurations via webhook.

**Advanced: Using with n8n Workflows for Dynamic Model Selection**

JsonHttpModelLoader can be combined with n8n workflows to implement sophisticated, dynamic model filtering and selection logic. This allows you to:

- **Apply custom business logic** to determine which models are available
- **Filter models by user roles/permissions** - expose different models to different users
- **Dynamically select models** based on tenant, organization, or department
- **Apply additional criteria** like resource availability, licensing, or feature flags
- **Centralize model configuration** while keeping selection logic in n8n

**Architecture:**

```
n8n-openai-bridge
    ↓ polls every 300s
[n8n Workflow (HTTP Trigger)]
    ↓
[Filter/Transform Logic]
    ↓ returns JSON
{ "model-id": "webhook-url", ... }
```

**How It Works:**

1. Configure JsonHttpModelLoader with endpoint pointing to n8n webhook
2. Create n8n workflow with HTTP trigger (webhook node)
3. Workflow receives polling request from bridge
4. Workflow executes custom logic:
   - Query model catalog/database
   - Apply user/tenant criteria
   - Filter by available resources
   - Transform data to required format
5. Workflow returns JSON object with model mappings
6. Bridge validates, caches (with hash), and uses for requests

**Example Workflow Setup:**

```
HTTP Trigger (Webhook)
    ↓
Query Database/API
    ↓
Filter Models (Apply Criteria)
    ↓
Transform to Required Format
    ↓
Return JSON Response
```

**Use Case Examples:**

1. **Role-based Model Availability:**
   ```json
   // For admin users
   {
     "gpt-4": "https://n8n.../webhook/gpt4",
     "gpt-4-turbo": "https://n8n.../webhook/gpt4-turbo",
     "claude-3": "https://n8n.../webhook/claude"
   }
   
   // For regular users
   {
     "gpt-3.5-turbo": "https://n8n.../webhook/gpt35"
   }
   ```

2. **Tenant-based Selection:**
   - Workflow queries which models customer's subscription includes
   - Returns only available models for that tenant
   - Prevents unauthorized access to premium models

3. **Resource-aware Selection:**
   - Workflow checks available GPU/compute resources
   - Only exposes models for available resources
   - Prevents overload from unavailable services

4. **Feature Flag Control:**
   - Workflow queries feature flags
   - Dynamically enables/disables experimental models
   - Rollout control without redeploying

**Configuration Example:**

```bash
MODEL_LOADER_TYPE=json-http
JSON_HTTP_ENDPOINT=https://your-n8n.com/webhook/model-selector
JSON_HTTP_POLL_INTERVAL=300        # Recheck available models every 5 minutes
JSON_HTTP_TIMEOUT=10000            # Allow workflow up to 10 seconds to respond
```

**n8n Workflow Development:**

When building your model selection workflow:

1. **Receive request** - HTTP trigger automatically receives polling request
2. **Query your criteria** - Check database, APIs, or configuration
3. **Filter models** - Apply business logic (roles, tenants, resources, etc.)
4. **Transform data** - Build JSON response in required format:
   ```json
   {
     "model-id": "https://full-webhook-url-including-domain",
     "model-id-2": "https://another-webhook-url"
   }
   ```
5. **Return response** - Respond with 200 and JSON object

**Important Notes:**

- Workflow endpoint must return valid JSON object (not array)
- Each webhook URL must be complete (including domain/protocol)
- Ensure workflow completes within `JSON_HTTP_TIMEOUT` (default 10s)
- Models are cached (hash-based), so frequent polling is efficient
- Workflow errors log warning but keep using previously cached models
- Invalid model entries are filtered with warnings (graceful degradation)

**Advantages Over N8nApiModelLoader:**

| Aspect | N8nApiModelLoader | JsonHttpModelLoader + Workflow |
|--------|-------------------|-------------------------------|
| **Setup Complexity** | Simple (tag-based) | More flexible but requires workflow |
| **Filtering Logic** | Tag-based only | Unlimited custom logic |
| **User-aware** | No | Yes (workflow can access user context) |
| **Tenant Support** | No | Yes (workflow can filter by tenant) |
| **Resource Awareness** | No | Yes (workflow can check resources) |
| **Auth Support** | API key required | Flexible (can use any n8n auth) |

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

| Feature | JsonFileModelLoader | N8nApiModelLoader | JsonHttpModelLoader | StaticModelLoader |
|---------|-------------------|-------------------|-------------------|-------------------|
| **Type ID** | `file` | `n8n-api` | `json-http` | `static` |
| **Use Case** | Manual configuration | Auto-discovery | Remote config | Testing only |
| **Startup Speed** | Fast | Depends on API | Depends on endpoint | Fast |
| **Hot-Reload** | File watching | Polling | Polling | None |
| **Dependencies** | None | n8n API access | HTTP endpoint | None |
| **Authentication** | N/A | Required (API key) | None (future support) | N/A |

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
| "No models discovered" | No workflows tagged or no chatTrigger node | Ensure workflows have `n8n-openai-bridge` tag AND chatTrigger node |
| "No webhook node found" | Missing chatTrigger node | Add `@n8n/n8n-nodes-langchain.chatTrigger` node to workflow |
| "Invalid token" (401) | Token invalid/expired | Regenerate in n8n Settings > n8n API |
| Models don't update | Polling disabled | Check `AUTO_DISCOVERY_POLL_INTERVAL` value (0 disables) |
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
- **JSON HTTP Loader**: `src/loaders/JsonHttpModelLoader.js`
- **Static Loader**: `src/loaders/StaticModelLoader.js`
- **Factory**: `src/factories/ModelLoaderFactory.js`
- **Config Integration**: `src/config.js`
- **Tests**: `tests/loaders/`

---

## Related Documentation

- **[Configuration Guide](CONFIGURATION.md)** - All environment variables
- **[n8n Setup Guide](N8N_SETUP.md)** - Configure n8n workflows
- **[Troubleshooting](TROUBLESHOOTING.md)** - Common issues
