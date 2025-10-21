# n8n OpenAI Bridge

OpenAI-compatible API middleware for n8n workflows. Use your n8n agents and workflows as OpenAI models in any OpenAI-compatible client.

## Features

- Full OpenAI Chat Completion API compatibility
- Streaming and non-streaming responses
- Multi-model support via JSON configuration
- Session tracking for conversation memory
- User context forwarding (ID, email, name, role)
- Bearer token authentication with timing-safe comparison
- Rate limiting with configurable thresholds per endpoint
- Request ID tracking for distributed tracing
- Docker ready with health checks
- Hot-reload models without restart

## Compatibility

Works with any OpenAI-compatible client or middleware.

**Chat Frontends (tested):**
- [Open WebUI](https://github.com/open-webui/open-webui)
- [LibreChat](https://github.com/danny-avila/LibreChat)
- [AnythingLLM](https://github.com/Mintplex-Labs/anything-llm)

**Middleware (tested):**
- [LiteLLM](https://github.com/BerriAI/litellm)

Compatible with [OpenRouter](https://openrouter.ai/) and other OpenAI-compatible services.

See [Integration Guide](docs/INTEGRATIONS.md) for setup.

## Architecture

```
   ┌─────────────────────────────────────────────┐
   │  OpenAI Clients (Open WebUI, LibreChat...)  │
   └────────────────────┬────────────────────────┘
                        │ OpenAI API Format
                        │ /v1/chat/completions
                        ▼
              ┌─────────────────────┐
              │ n8n OpenAI Bridge   │
              │ • Auth & Routing    │
              │ • Session Tracking  │
              │ • Format Translation│
              └──────────┬──────────┘
                         │ n8n Webhook
              ┌──────────┼──────────┐
              ▼          ▼          ▼
         ┌────────┐ ┌────────┐ ┌────────┐
         │  n8n   │ │  n8n   │ │  n8n   │
         │ Agent  │ │ Agent  │ │ Agent  │
         │(Claude)│ │ (GPT-4)│ │(Custom)│
         └────────┘ └────────┘ └────────┘
              │          │          │
              └──────────┴──────────┘
                         │
                    AI Response
                (Streaming/Non-streaming)
```

## Quick Start

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

# Test the API
curl http://localhost:3333/health
curl -H "Authorization: Bearer your-secret-api-key-here" \
  http://localhost:3333/v1/models
```

## Documentation

### Getting Started

- **[Installation Guide](docs/INSTALLATION.md)** - Docker and source installation
- **[Configuration Guide](docs/CONFIGURATION.md)** - Environment variables and models setup
- **[ModelLoader Documentation](docs/MODELLOADER.md)** - Model loading system architecture and configuration
- **[n8n Workflow Setup](docs/N8N_SETUP.md)** - Configure n8n workflows

### Usage

- **[API Usage Guide](docs/USAGE.md)** - API endpoints and code examples
- **[Integration Guide](docs/INTEGRATIONS.md)** - Open WebUI and LibreChat integration
- **[API Documentation](openapi.yaml)** - Complete OpenAPI 3.1 specification

### Development

- **[Development Guide](docs/DEVELOPMENT.md)** - Project structure, make commands, and workflow
- **[Testing Guide](docs/TESTING.md)** - Unit tests and image tests
- **[Troubleshooting Guide](docs/TROUBLESHOOTING.md)** - Common issues and solutions

### Additional Resources

- **[Release Documentation](docs/RELEASE.md)** - Release process and versioning
- **[CI/CD Workflows](.github/workflows/README.md)** - Automated testing and releases
- **[Logging Guide](docs/LOGGING.md)** - Logging configuration and debugging

## Model Loading System

The bridge uses a flexible **ModelLoader architecture** to load models from different sources. Two approaches are available:

### Loaders

| Loader | Type | Use Case |
|--------|------|----------|
| **JsonFileModelLoader** | File-based | Manual configuration in `models.json`, hot-reload on changes |
| **N8nApiModelLoader** | Auto-discovery | Workflows tagged with a specific tag are automatically discovered as models |

### Quick Start: File-based (Default)

```json
{
  "model-id": "https://n8n.example.com/webhook/abc123/chat"
}
```

Save to `models.json`. Changes are automatically detected and reloaded (100ms debounce). No additional configuration required.

### Quick Start: Auto-Discovery (Recommended)

```bash
MODEL_LOADER_TYPE=n8n-api
N8N_BASE_URL=https://your-n8n-instance.com
N8N_API_BEARER_TOKEN=n8n_api_xxxxxxxxxxxxx
AUTO_DISCOVERY_TAG=n8n-openai-bridge
AUTO_DISCOVERY_POLLING=300
```

Tag your n8n workflows with `n8n-openai-bridge` (configurable) and they are automatically discovered and exposed as models. Polling interval can be configured (default: 300 seconds).

For detailed setup, configuration, and troubleshooting, see:
- **[ModelLoader Documentation](docs/MODELLOADER.md)** - Architecture, all loaders, setup guides
- **[Configuration Guide](docs/CONFIGURATION.md)** - Environment variables and options

## Project Structure

```
n8n-openai-bridge/
├── src/
│   ├── server.js          # Express server setup
│   ├── n8nClient.js       # n8n webhook client
│   ├── config.js          # Configuration & models loader
│   ├── routes/            # API endpoints
│   ├── handlers/          # Request handlers
│   ├── middleware/        # Express middleware
│   ├── services/          # Business logic services
│   ├── loaders/           # Model loader architecture
│   └── utils/             # Utility functions
├── tests/                 # Unit tests
├── docker/                # Docker configuration
├── docs/                  # Documentation
├── models.json            # Model configuration (git-ignored)
├── .env                   # Environment variables (git-ignored)
├── Makefile               # Build automation
└── package.json           # Node.js dependencies
```

## Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add: amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

Please ensure:
- All tests pass (`make test`)
- Code passes linting (`make lint`)
- Code is properly formatted (`make format`)
- Docker build succeeds
- Update documentation as needed

See [Development Guide](docs/DEVELOPMENT.md) for details.

## License

This project is licensed under the **GNU Affero General Public License v3.0 (AGPL-3.0)**.

### What this means

- You can use, modify, and distribute this software freely
- You must share your modifications under the same license
- If you run a modified version as a web service, you must make the source code available
- Original author attribution is required

See the [LICENSE](LICENSE) file for full details.

### License History

- **v0.0.7+**: AGPL-3.0 (current)
- **v0.0.1 - v0.0.6**: Apache 2.0 (previous versions remain under Apache 2.0)

See [LICENSE-TRANSITION.md](LICENSE-TRANSITION.md) for migration details.

---

**Issues:** [GitHub Issues](https://github.com/sveneisenschmidt/n8n-openai-bridge/issues) | **Releases:** [GitHub Releases](https://github.com/sveneisenschmidt/n8n-openai-bridge/releases)
