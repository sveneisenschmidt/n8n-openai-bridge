# Integration Guide

Guide for integrating n8n OpenAI Bridge with various clients.

## Table of Contents

- [Open WebUI](#open-webui)
- [LibreChat](#librechat)

## Open WebUI

### Setup

**Settings:** Settings → Connections → OpenAI API
- API Base URL: `http://your-server:3333/v1`
- API Key: Your `BEARER_TOKEN` from `.env`
- Set `ENABLE_FORWARD_USER_INFO_HEADERS=true` (required for session and user tracking)

### User Context Integration

Open WebUI automatically forwards user information via HTTP headers when `ENABLE_FORWARD_USER_INFO_HEADERS=true`. Set it in your OpenWebUI configuration, [learn more about in the official OpenWebUI documentation](https://docs.openwebui.com/getting-started/env-configuration/#enable_forward_user_info_headers):
- `X-OpenWebUI-User-Id` - User's unique identifier
- `X-OpenWebUI-User-Email` - User's email address
- `X-OpenWebUI-User-Name` - User's display name
- `X-OpenWebUI-User-Role` - User's role (admin, user, etc.)
- `X-OpenWebUI-Chat-Id` - Chat session identifier

To enable OpenWebUI header support, add them to the n8n-openai-bridge encironment, for example in `.env` (second value with each ENV VAR):

```bash
SESSION_ID_HEADERS=X-Session-Id,X-OpenWebUI-Chat-Id
USER_ID_HEADERS=X-User-Id,X-OpenWebUI-User-Id
USER_EMAIL_HEADERS=X-User-Email,X-OpenWebUI-User-Email
USER_NAME_HEADERS=X-User-Name,X-OpenWebUI-User-Name
USER_ROLE_HEADERS=X-User-Role,X-OpenWebUI-User-Role
```

This allows your n8n workflows to:
- Personalize responses based on user role
- Track user-specific conversations
- Implement role-based access control
- Log user activity for analytics

## LibreChat

### Setup

Add to your `librechat.yaml` configuration, [learn more about it in the official documentation](https://www.librechat.ai/docs/configuration/librechat_yaml/object_structure/custom_endpoint):

```yaml
endpoints:
  custom:
    - name: "n8n"
      apiKey: "your-secret-api-key-here"
      baseURL: "http://n8n-openai-bridge:3333/v1"
      models:
        default: ["placeholder-model-do-not-remove-me"]
        fetch: true
      headers:
        X-Chat-Id: "{{LIBRECHAT_BODY_CONVERSATIONID}}"
        X-User-Id: "{{LIBRECHAT_USER_ID}}"
        X-User-Email: "{{LIBRECHAT_USER_EMAIL}}"
        X-User-Name: "{{LIBRECHAT_USER_NAME}}"
        X-User-Role: "{{LIBRECHAT_USER_ROLE}}"
      titleConvo: true
      summary: true
```

Librechat requires a valid `models.default` value which must not be empty but will be overridden by the models that have been fetched.

### Configuration Notes

- `apiKey`: Must match your `BEARER_TOKEN` from `.env`
- `baseURL`: Use `http://n8n-openai-bridge:3333/v1` if running in Docker, or `http://your-server:3333/v1` for external access
- `fetch: true`: Automatically fetches available models from the bridge
- `titleConvo` and `summary`: Enable automatic conversation titling and summarization

### User Context Integration

LibreChat provides template variables that can be mapped to custom headers:
- `{{LIBRECHAT_BODY_CONVERSATIONID}}` → `X-Chat-Id` - Session tracking
- `{{LIBRECHAT_USER_ID}}` → `X-User-Id` - User identifier
- `{{LIBRECHAT_USER_EMAIL}}` → `X-User-Email` - User email address
- `{{LIBRECHAT_USER_NAME}}` → `X-User-Name` - User display name
- `{{LIBRECHAT_USER_ROLE}}` → `X-User-Role` - User role (user, admin, etc.)

These headers are automatically recognized by the bridge and forwarded to your n8n workflows, enabling:
- User-specific conversation history
- Role-based response customization
- User activity tracking and analytics
- Personalized AI agent behavior

## Next Steps

- [Set up n8n workflow](N8N_SETUP.md)
- [Configure settings](CONFIGURATION.md)
- [Learn API usage](USAGE.md)
