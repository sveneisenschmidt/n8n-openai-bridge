# Model Loader Architecture

Quick reference for the model loading system.

## Overview

The bridge uses a **ModelLoader** architecture to load models from different sources. Currently, only **JsonFileModelLoader** (JSON files) is included.

## Built-in: JsonFileModelLoader

Loads models from a JSON file with automatic hot-reload support.

### File Format

`models.json`:
```json
{
  "model-id": "https://n8n.example.com/webhook/abc123/chat",
  "gpt-4": "https://n8n.example.com/webhook/gpt4/chat"
}
```

### Behavior

| Aspect | Details |
|--------|---------|
| **Startup** | Reads file synchronously, validates models, throws if file not found or JSON invalid |
| **Hot-Reload** | Watches file via `fs.watch()`, 100ms debounce, reloads on change |
| **Invalid Models** | Filtered out with warnings (graceful degradation) |
| **Watch Failure** | Logged as warning, still usable without watch |

### Configuration

```bash
MODELS_CONFIG=./models.json  # Path to models file
```

---

## Validation Rules

Applied to all loaded models:

1. **Root**: Must be a plain object (not array)
2. **Model ID**: Non-empty string
3. **Webhook URL**: Non-empty string + valid HTTP/HTTPS URL

Invalid entries filtered out with warnings (graceful degradation).

### Example

Input:
```json
{
  "valid": "https://example.com/hook",
  "": "https://example.com/hook",
  "bad": "not-a-url"
}
```

Result:
```javascript
{ "valid": "https://example.com/hook" }
// Warnings logged for empty ID and bad URL
```

---

## Error Handling

| Error | Behavior |
|-------|----------|
| File not found | Throws error, blocks startup |
| Invalid JSON | Throws error, shows JSON error details |
| Invalid model entry | Skipped, warning logged, server continues |
| Watch setup fails | Warning logged, still usable without watch |

---

## Troubleshooting

| Problem | Cause | Solution |
|---------|-------|----------|
| App won't start | File not found / invalid JSON | Check MODELS_CONFIG path and JSON syntax |
| Models don't hot-reload | File changes not detected | Check logs, try manual reload via API |
| Some models missing | Invalid entries | Validate URLs and model IDs in models.json |
| Many warnings in logs | Bad model data | Fix models.json entries |

### Manual Reload

```bash
curl -X POST -H "Authorization: Bearer your-token" \
  http://localhost:3333/admin/reload
```

---

## Code References

- **Base Class**: `src/loaders/ModelLoader.js`
- **JSON Loader**: `src/loaders/JsonFileModelLoader.js`
- **Tests**: `tests/unit/loaders/`
- **Configuration**: See [CONFIGURATION.md](CONFIGURATION.md)
