# Installation Guide

Complete guide for installing n8n OpenAI Bridge.

## Table of Contents

- [Option 1: Docker Image (Recommended)](#option-1-docker-image-recommended)
- [Option 2: Build from Source](#option-2-build-from-source)

## Option 1: Docker Image (Recommended)

The Docker image comes with default configuration files built-in. Simply mount your custom `models.json` to configure your n8n webhooks.

### Available Image Tags

- `latest` - Latest stable release
- `0.0.3` - Specific version
- `0.0` - Latest patch version of 0.0.x
- `0` - Latest minor version of 0.x.x

### Quick Start

```bash
# Create models configuration
cat > models.json << 'EOF'
{
  "my-agent": "https://n8n.example.com/webhook/abc123/chat"
}
EOF

# Run container
docker run -d \
  --name n8n-openai-bridge \
  -p 3333:3333 \
  -e BEARER_TOKEN=your-secret-api-key-here \
  -v $(pwd)/models.json:/app/models.json:ro \
  ghcr.io/sveneisenschmidt/n8n-openai-bridge:latest

# Check health
curl http://localhost:3333/health
```

### Docker Compose

```yaml
services:
  n8n-openai-bridge:
    image: ghcr.io/sveneisenschmidt/n8n-openai-bridge:latest
    container_name: n8n-openai-bridge
    ports:
      - "3333:3333"
    environment:
      - BEARER_TOKEN=your-secret-api-key-here
      - N8N_WEBHOOK_BEARER_TOKEN=
      - LOG_REQUESTS=false
      - SESSION_ID_HEADERS=X-Session-Id,X-Chat-Id,X-OpenWebUI-Chat-Id
    volumes:
      - ./models.json:/app/models.json:ro
    restart: unless-stopped
```

### Built-in vs Custom Configuration

The Docker image includes built-in configuration files:
- Built-in `.env` with default settings
- Built-in `models.json` with placeholder model (`docker-default-model`)

**To use custom configuration:**
- Mount your `models.json` to `/app/models.json` (replaces built-in models)
- Set environment variables via `-e` or Docker Compose (overrides built-in .env)

**Verification:**

```bash
# Check if your custom models are loaded
curl -H "Authorization: Bearer your-token" http://localhost:3333/v1/models

# If you see "docker-default-model" -> your mount is NOT working
# If you see your custom models -> configuration is correct
```

## Option 2: Build from Source

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

Or manually: `docker compose -f docker/docker-compose.dev.yml up -d`

## Next Steps

- [Configure your environment](CONFIGURATION.md)
- [Set up n8n workflow](N8N_SETUP.md)
- [Learn API usage](USAGE.md)
