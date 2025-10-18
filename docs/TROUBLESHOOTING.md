# Troubleshooting Guide

Solutions to common problems with n8n OpenAI Bridge.

## Table of Contents

- [Enable Detailed Logging](#enable-detailed-logging)
- [Model Loading Issues](#model-loading-issues)
- [Docker Volume Mount Issues](#docker-volume-mount-issues)
- [Common Issues](#common-issues)
- [Getting Help](#getting-help)

## Enable Detailed Logging

Set `LOG_REQUESTS=true` in your `.env` file to enable detailed request/response logging:

```bash
LOG_REQUESTS=true
```

Restart the container:

```bash
docker restart n8n-openai-bridge
```

## Model Loading Issues

### Error Loading Models

**Symptom:** Server logs show "Error loading models"

**Possible causes:**
- Invalid JSON syntax in models.json
- Models.json is an array instead of an object
- Model URLs are not valid HTTP/HTTPS URLs

**Solution:**

```bash
# Validate JSON syntax
cat models.json | jq .

# Check server logs for specific error
docker logs n8n-openai-bridge 2>&1 | grep "Error loading models"

# Common errors:
# "Models must be an object" -> Change [] to {}
# "Invalid webhook URL" -> Check URL format (must start with http:// or https://)
```

### Models Not Reloading

**Symptom:** Models not reloading after changes

**Solution:**

```bash
# For mounted volumes, restart container to reload
docker restart n8n-openai-bridge

# Or use the reload endpoint
curl -X POST -H "Authorization: Bearer your-token" \
  http://localhost:3333/admin/reload
```

## Docker Volume Mount Issues

### Seeing "docker-default-model"

**Symptom:** Seeing "docker-default-model" when listing models

**This means:** Your custom `models.json` mount is NOT working

**Solution:**

```bash
# Verify volume mount
docker inspect n8n-openai-bridge | grep -A 5 Mounts

# Correct mount should show:
# "Source": "/path/to/your/models.json"
# "Destination": "/app/models.json"

# Fix mount path and restart
docker stop n8n-openai-bridge
docker rm n8n-openai-bridge

# Run with absolute path
docker run -d \
  --name n8n-openai-bridge \
  -p 3333:3333 \
  -e BEARER_TOKEN=your-token \
  -v /full/path/to/models.json:/app/models.json:ro \
  ghcr.io/sveneisenschmidt/n8n-openai-bridge:latest

# Verify models are loaded
curl -H "Authorization: Bearer your-token" \
  http://localhost:3333/v1/models
```

## Common Issues

### "Model not found"

- Check that model ID exists in `models.json`
- Verify `models.json` is properly mounted (should NOT see "docker-default-model")
- Check server logs for model loading errors

### "Unauthorized"

- Verify `BEARER_TOKEN` in `.env` matches the token in your request
- Check `Authorization: Bearer <token>` header format
- Ensure no extra spaces or newlines in token

### Webhook not responding

- Test webhook directly with curl:

```bash
curl -X POST https://n8n.example.com/webhook/abc123/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{"role": "user", "content": "test"}],
    "sessionId": "test-session"
  }'
```

- Verify workflow is activated in n8n
- Check n8n logs for errors

### Streaming issues

- Try with `stream: false` first to isolate the issue
- Verify n8n workflow has "Enable Streaming" checked on AI Agent node
- Check Response Mode is set to "Streaming" on Chat Trigger node

### Rate limiting errors

- Check if rate limit is configured too low in code
- Review request patterns (are you making too many requests?)
- Consider increasing rate limits for your use case

## Getting Help

If you encounter issues not covered here:

1. Check server logs: `docker logs n8n-openai-bridge`
2. Enable detailed logging: `LOG_REQUESTS=true`
3. Review the [GitHub Issues](https://github.com/sveneisenschmidt/n8n-openai-bridge/issues)
4. Open a new issue with:
   - Server logs
   - Your configuration (redact sensitive tokens)
   - Steps to reproduce
   - Expected vs actual behavior

## Next Steps

- [Review configuration](CONFIGURATION.md)
- [Check n8n setup](N8N_SETUP.md)
- [Read API documentation](USAGE.md)
