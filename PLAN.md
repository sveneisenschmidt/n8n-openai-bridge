# Implementation Plan: Auto Discovery Model Loader (Issue #16)

**Branch:** `feature/auto-discovery-model-loader`  
**Issue:** https://github.com/sveneisenschmidt/n8n-openai-bridge/issues/16  
**Date:** 2025-10-21

---

## Goal

Automatic discovery of n8n workflows as OpenAI models via n8n REST API, eliminating the need for manual `models.json` maintenance.

---

## Requirements from Issue #16

### New Environment Variables

#### Authentication Tokens

1. **`N8N_API_BEARER_TOKEN`** (new)
   - API key for n8n REST API access
   - Header: `X-N8N-API-KEY`
   - ⚠️ Read/Write access to n8n (security-relevant!)
   - Required when auto-discovery is enabled

2. **`N8N_WEBHOOK_BEARER_TOKEN`** (already exists)
   - For webhook authentication (if n8n webhooks require bearer token)
   - Alias: `N8N_BEARER_TOKEN` (deprecated, already supported)

3. **`N8N_BASE_URL`** (new)
   - Base URL of n8n instance
   - Example: `https://your-n8n-instance.com`
   - Required when auto-discovery is enabled

#### Auto-Discovery Configuration

1. **`AUTO_DISCOVERY_FETCH_MODELS`** (boolean, default: `false`)
   - Enables/Disables auto-discovery
   - When `false`: Classic JsonFileModelLoader behavior

2. **`AUTO_DISCOVERY_TAG`** (string, default: `openai-model`)
   - Tag filter for n8n workflows
   - Only workflows with this tag are recognized as models

3. **`AUTO_DISCOVERY_POLLING`** (number, default: `300` seconds)
   - Polling interval for re-querying n8n API
   - Range: 60-600 seconds
   - `0` = Polling disabled (only load at startup)

### Isolation

- **Completely isolated from models.json**
- Project can work with empty `models.json` (just `{}`)
- Auto-Discovery and JsonFile cannot be active simultaneously

---

## Architecture Decisions

### 1. New Loader: `N8nApiModelLoader`

**Inheritance:** `ModelLoader` (base class)

**Responsibilities:**
- n8n API communication (GET /api/v1/workflows)
- Filter by tags
- Webhook URL extraction from workflow nodes
- Polling mechanism for auto-reload
- Model ID generation from workflow names/tags

**Not responsible for:**
- Model validation (handled by base class `ModelLoader.validateModels()`)
- Config management (handled by `Config` class)

### 2. Config Changes

**In `src/config.js`:**

```javascript
createModelLoader() {
  // Auto-Discovery enabled?
  const autoDiscovery = process.env.AUTO_DISCOVERY_FETCH_MODELS === 'true';
  
  if (autoDiscovery) {
    const N8nApiModelLoader = require('./loaders/N8nApiModelLoader');
    
    const n8nBaseUrl = process.env.N8N_BASE_URL;
    if (!n8nBaseUrl) {
      throw new Error('N8N_BASE_URL required when AUTO_DISCOVERY_FETCH_MODELS is enabled');
    }
    
    const apiToken = process.env.N8N_API_BEARER_TOKEN;
    if (!apiToken) {
      throw new Error('N8N_API_BEARER_TOKEN required when AUTO_DISCOVERY_FETCH_MODELS is enabled');
    }
    
    const tag = process.env.AUTO_DISCOVERY_TAG || 'openai-model';
    const polling = parseInt(process.env.AUTO_DISCOVERY_POLLING || '300', 10);
    
    console.log(`Auto-discovery enabled: polling n8n every ${polling}s for tag "${tag}"`);
    
    return new N8nApiModelLoader(n8nBaseUrl, apiToken, tag, polling);
  }
  
  // Default: JsonFileModelLoader
  return new JsonFileModelLoader(this.modelsConfigPath);
}
```

**Constructor changes:**
```javascript
constructor() {
  // ... existing code ...
  
  this.modelLoader = this.createModelLoader();
  this.models = {};
  this.modelsReady = false;
  
  // Start async loading (Promise tracking)
  this.loadingPromise = this.loadModels()
    .then(models => {
      this.models = models;
      this.modelsReady = true;
      console.log(`Models loaded: ${Object.keys(models).length} available`);
      return models;
    })
    .catch(error => {
      console.error('Failed to load models:', error.message);
      throw error; // Propagate error to server startup
    });
  
  this.setupFileWatcher();
}
```

### 3. Model ID Generation

**Priority order for mapping workflows to model IDs:**

1. **Custom Tag** (if second tag exists, e.g., `model:gpt-4-agent`)
   - Format: `model:actual-id`
   - Allows explicit ID control

2. **Workflow Name** (standard)
   - Lowercase + Spaces → Hyphens
   - Example: "GPT-4 Agent" → "gpt-4-agent"

3. **Fallback: Workflow ID**
   - If name is invalid

**Implementation:**
```javascript
function generateModelId(workflow) {
  // Search for "model:" tag
  const modelTag = workflow.tags.find(t => t.name.startsWith('model:'));
  if (modelTag) {
    return modelTag.name.substring(6); // Remove "model:" prefix
  }
  
  // Workflow name as ID
  const sanitized = workflow.name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-_]/g, '');
  
  return sanitized || workflow.id;
}
```

### 4. Webhook URL Extraction

**Logic:**
```javascript
function extractWebhookUrl(workflow, n8nBaseUrl) {
  // Find first webhook node
  const webhookNode = workflow.nodes.find(
    node => node.type === 'n8n-nodes-base.webhook'
  );
  
  if (!webhookNode || !webhookNode.parameters?.path) {
    return null; // No webhook found
  }
  
  const path = webhookNode.parameters.path;
  
  // Only production URL if workflow is active
  if (!workflow.active) {
    console.warn(`Workflow "${workflow.name}" has webhook but is inactive`);
    return null;
  }
  
  return `${n8nBaseUrl}/webhook/${path}`;
}
```

**Important:**
- Only **active** workflows are registered as models
- Only **production webhook URL** is used
- Test URLs are **not** supported (unreliable)

---

## Server Startup Behavior

**Requirement: Server MUST have models loaded before accepting requests**

```javascript
// src/server.js
async function startServer() {
  console.log('Loading models...');
  
  try {
    await config.loadingPromise;  // MUST succeed
    console.log(`Models loaded: ${Object.keys(config.models).length} available`);
  } catch (error) {
    console.error('FATAL: Failed to load models:', error.message);
    console.error('Server cannot start without models');
    process.exit(1);  // Exit on error!
  }
  
  const server = app.listen(config.port, () => {
    console.log(`Server ready on port ${config.port}`);
  });
  
  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    config.close();
    server.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
  });
}

startServer().catch(error => {
  console.error('Fatal error starting server:', error);
  process.exit(1);
});
```

**Consequences:**

**JsonFileModelLoader:**
- `models.json` not found → Server does NOT start ❌
- Invalid JSON → Server does NOT start ❌
- Empty `{}` → Server starts ✅ (0 models is ok)

**N8nApiModelLoader:**
- n8n API unreachable → Server does NOT start ❌
- API token invalid → Server does NOT start ❌
- No workflows found → Server starts ✅ (0 models is ok)
- n8n API timeout → Server does NOT start ❌

---

## Implementation Order

### Phase 1: Base Implementation
1. ✅ Create `src/loaders/N8nApiModelLoader.js`
2. ✅ Base methods: `load()`, `fetchWorkflows()`, `workflowsToModels()`
3. ✅ Model ID generation: `generateModelId()`
4. ✅ Webhook extraction: `extractWebhookUrl()`

### Phase 2: Config Integration
5. ✅ Modify `src/config.js`: `createModelLoader()`
6. ✅ Server startup logic: async model loading
7. ✅ Extend `.env.example`

### Phase 3: Polling & Watch
8. ✅ Implement `watch()` with polling
9. ✅ `stopWatching()` for graceful shutdown
10. ✅ Error handling for API failures

### Phase 4: Tests
11. ✅ Unit tests for `N8nApiModelLoader`
12. ✅ Integration tests with mock n8n API
13. ✅ Config tests for auto-discovery mode
14. ✅ Check test coverage (target: >75%)

### Phase 5: Documentation
15. ✅ Create `docs/AUTO_DISCOVERY.md`
16. ✅ Update existing docs
17. ✅ Code comments & JSDoc

### Phase 6: Polish
18. ✅ Linting & Formatting (`make lint`, `make format`)
19. ✅ Docker tests (`make test-image`)
20. ✅ End-to-End test with real n8n

---

## n8n API Reference (Research Results)

### Authentication
```bash
# Header format
X-N8N-API-KEY: n8n_api_xxxxxxxxxxxxx

# Create API key
# n8n UI → Settings → n8n API → Create API key
```

### GET Workflows Endpoint
```bash
GET /api/v1/workflows

# Query Parameters:
# - active (boolean): Filter for active workflows
# - tags (string): Comma-separated tag names
# - limit (number): Pagination limit

# Example:
curl -X GET 'https://your-n8n.com/api/v1/workflows?active=true&tags=openai-model' \
  -H 'X-N8N-API-KEY: n8n_api_xxxxx'
```

### Workflow Object Structure
```json
{
  "id": "workflow-id",
  "name": "Workflow Name",
  "active": true,
  "tags": [
    {
      "id": "tag-id",
      "name": "openai-model"
    }
  ],
  "nodes": [
    {
      "type": "n8n-nodes-base.webhook",
      "parameters": {
        "path": "my-webhook-path",
        "httpMethod": "POST"
      }
    }
  ],
  "createdAt": "2025-01-01T00:00:00.000Z",
  "updatedAt": "2025-01-01T00:00:00.000Z"
}
```

### Webhook URL Construction
```javascript
const webhookPath = node.parameters.path;
const n8nBaseUrl = "https://your-n8n.com";
const isActive = workflow.active;

const webhookUrl = isActive 
  ? `${n8nBaseUrl}/webhook/${webhookPath}`
  : `${n8nBaseUrl}/webhook-test/${webhookPath}`;
```

---

## New Environment Variables

### .env.example additions

```bash
# Auto-Discovery Configuration (Optional)
# Automatically discover n8n workflows as OpenAI models via n8n API

# Enable auto-discovery (default: false)
# When enabled, models are loaded from n8n API instead of models.json
# AUTO_DISCOVERY_FETCH_MODELS=true

# n8n instance base URL (required when auto-discovery is enabled)
# N8N_BASE_URL=https://your-n8n-instance.com

# n8n API key (required when auto-discovery is enabled)
# Create in: n8n Settings > n8n API
# WARNING: This token has read/write access to your n8n instance
# N8N_API_BEARER_TOKEN=n8n_api_xxxxxxxxxxxxx

# Tag to filter workflows (default: openai-model)
# Only workflows with this tag will be exposed as OpenAI models
# AUTO_DISCOVERY_TAG=openai-model

# Polling interval in seconds (default: 300, range: 60-600, 0 to disable)
# How often to check n8n for new/updated workflows
# AUTO_DISCOVERY_POLLING=300
```

---

## Security Considerations

### 1. API Token Protection
- **Never** commit to git
- Use environment variables
- Mask in logs (similar to BEARER_TOKEN)

### 2. API Permissions
- Token has **Read/Write** access to n8n
- Potentially dangerous if compromised
- Documentation must warn about this

### 3. Rate Limiting
- n8n API might have rate limits
- Don't set polling interval too low (min 60s)
- Consider exponential backoff on errors

### 4. Network Security
- HTTPS for n8n API recommended
- Certificate validation (no self-signed certs without opt-in)

---

## Error Handling

### Startup Errors
```javascript
// config.js constructor
try {
  this.loadingPromise = this.loadModels();
} catch (error) {
  console.error('Failed to initialize model loader:', error);
  throw error; // Propagate to server.js → process.exit(1)
}
```

### Runtime Errors (Polling)
```javascript
// N8nApiModelLoader.watch()
try {
  const models = await this.load();
  this.watchCallback(models);
} catch (error) {
  console.error('Polling error:', error.message);
  // Continue polling - don't give up on temporary failures
}
```

### API Errors
- **401 Unauthorized**: Token invalid → clear error message
- **403 Forbidden**: Token lacks permissions → hint about scopes
- **404**: n8n not reachable → DNS/Network problem
- **Timeout**: n8n overloaded → Retry with backoff?

---

## Migration Strategy

### For Existing Users

**No Breaking Changes:**
- Default remains `AUTO_DISCOVERY_FETCH_MODELS=false`
- JsonFileModelLoader remains default
- Existing `models.json` continues to work

**Opt-In Migration:**
1. Create n8n API key
2. Tag workflows with `openai-model`
3. Set ENV variables
4. Restart server
5. Empty `models.json` to `{}` (optional)

**Rollback:**
- Set `AUTO_DISCOVERY_FETCH_MODELS=false`
- Use old `models.json` again

---

## Documentation Updates Required

1. **`docs/AUTO_DISCOVERY.md`** (new)
   - Setup guide for n8n API key
   - Workflow tagging best practices
   - Troubleshooting

2. **`docs/CONFIGURATION.md`**
   - New section: "Auto-Discovery Mode"
   - Configuration examples
   - Comparison: JsonFile vs. Auto-Discovery

3. **`docs/MODELLOADER.md`**
   - Documentation for `N8nApiModelLoader`
   - Architecture diagram
   - Webhook extraction logic

4. **`README.md`**
   - Quick start with auto-discovery
   - Feature list update

5. **`AGENTS.md`**
   - Developer guide for auto-discovery
   - Code examples

---

## Testing Strategy

### Unit Tests (`tests/loaders/N8nApiModelLoader.test.js`)

**Test Categories:**

1. **Constructor & Initialization**
   - Valid parameters
   - Polling interval validation (min 60, max 600)
   - URL normalization (trailing slash removal)

2. **API Communication**
   - `fetchWorkflows()` with correct headers
   - Tag and active status filtering
   - Error handling (401, 403, timeout, invalid JSON)

3. **Webhook Extraction**
   - Extract from webhook nodes
   - Handle missing webhook nodes
   - Handle missing path parameter
   - Production URL construction

4. **Model ID Generation**
   - Priority: "model:" tag
   - Fallback: sanitized workflow name
   - Fallback: workflow ID
   - Handle empty names

5. **Workflow to Models Conversion**
   - Convert array to object
   - Skip workflows without webhooks
   - Handle duplicate model IDs
   - Warn about inactive workflows

6. **Loading**
   - `load()` success
   - `loadSync()` throws error
   - Validation through base class

7. **Polling**
   - Start/stop polling
   - Callback invocation
   - Disabled when interval=0
   - Error recovery during polling

**Mock Strategy:**
- Mock `axios` for API calls
- Mock workflows with various structures
- Mock timers for polling tests
- Suppress console output in tests

---

## Open Questions / Trade-offs

### 1. Webhook URL Security
**Problem:** Production webhook URLs are publicly visible (no auth by default).

**Mitigations:**
- Only **active** workflows are exposed
- Users should use `N8N_WEBHOOK_BEARER_TOKEN` for webhook auth
- Documentation must highlight this

### 2. Model ID Collisions
**Problem:** Two workflows with same name → same model ID.

**Solution:**
- Log warning
- Fallback to workflow ID
- Document: Use `model:custom-id` tags

### 3. Polling vs. Webhooks
**Chosen:** Polling

**Alternatives:**
- **n8n Webhooks:** n8n could notify bridge on workflow changes
  - Pro: Instant updates
  - Con: Complex setup, n8n must know about bridge
  
- **n8n Change Logs:** API for "recently changed workflows"
  - Pro: More efficient than full poll
  - Con: Not sure if n8n supports this

**Decision:** Polling is simple and reliable.

---

## Estimated Complexity

**Lines of Code:**
- `N8nApiModelLoader.js`: ~250 LOC
- `Config.js` changes: ~30 LOC
- `Server.js` changes: ~20 LOC
- Tests: ~400 LOC
- Documentation: ~500 LOC

**Time Estimate:** 1-2 days development + testing

---

## Summary

### What will be implemented?

1. **New Model Loader:** `N8nApiModelLoader`
   - Loads workflows via n8n REST API
   - Filters by tags
   - Extracts webhook URLs
   - Polling for auto-reload

2. **Config Extension:**
   - Auto-discovery mode (opt-in)
   - New ENV variables
   - Loader factory pattern

3. **Server Changes:**
   - Async model loading at startup
   - Fail-fast if models can't load

4. **Documentation:**
   - Setup guide
   - API documentation
   - Security warnings

5. **Tests:**
   - Unit tests for all new components
   - Mock-based API tests
   - Integration tests

### Benefits

✅ **No manual models.json maintenance**  
✅ **Automatic workflow discovery**  
✅ **Tag-based filtering**  
✅ **Auto-reload via polling**  
✅ **Backwards compatible** (opt-in)  
✅ **Fail-fast startup** (server only runs with models)

---

## Next Steps

1. Implement `N8nApiModelLoader.js`
2. Update `config.js` and `server.js`
3. Write comprehensive tests
4. Update documentation
5. Manual testing with real n8n instance
6. Create pull request

---

**Plan created:** 2025-10-21  
**Last updated:** 2025-10-21
