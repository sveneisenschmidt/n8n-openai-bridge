# Docker Default Configuration Files

This directory contains default configuration files that are built into the Docker image.

## Files

### `.env`
Default environment configuration for the Docker container:
- `PORT=3333` - Server port
- `BEARER_TOKEN=change-me` - Default API token (must be changed!)
- `N8N_WEBHOOK_BEARER_TOKEN=` - Optional n8n webhook authentication
- `N8N_API_BEARER_TOKEN=` - Optional n8n API token (for auto-discovery)
- `LOG_REQUESTS=false` - Request logging disabled by default
- `SESSION_ID_HEADERS=...` - Default session ID header names

### `models.json`
Placeholder model configuration built into the Docker image:
```json
{
  "_comment": "This is a placeholder model built into the Docker image. Mount your own models.json to configure real n8n webhooks.",
  "docker-default-model": "https://n8n-openai-bridge.invalid/webhook/REPLACE-ME/chat"
}
```

**Important:** This is a **non-functional dummy URL** (`*.invalid` domain) that:
- Allows the container to start without errors
- Shows up in `/v1/models` endpoint as `docker-default-model`
- Helps with debugging - if you see this model, you know the mounted config wasn't loaded
- **Must be replaced** by mounting your own `models.json` with real n8n webhook URLs

## How It Works

These files are copied into the Docker image during build:
```dockerfile
COPY docker/.env ./.env
COPY docker/models.json ./models.json
```

**For end users:**
- The image works out-of-the-box with these defaults
- Users mount their own `models.json` to configure their n8n webhooks
- Environment variables can override the default `.env` values

**Example usage:**
```bash
docker run -d \
  -p 3333:3333 \
  -e BEARER_TOKEN=my-secret \
  -v $(pwd)/models.json:/app/models.json:ro \
  ghcr.io/sveneisenschmidt/n8n-openai-bridge:latest
```

## Separation of Concerns

| File | Purpose | Location |
|------|---------|----------|
| `docker/.env` | Built into image | For Docker defaults |
| `.env.example` | Template for developers | For local development |
| `.env` | User's local config | Git-ignored, not in image |
| `docker/models.json` | Built into image | Example/fallback model |
| `models.json.example` | Template for developers | For local development |
| `models.json` | User's actual config | Git-ignored, mounted by user |

This keeps the Docker-specific defaults separate from developer templates.
