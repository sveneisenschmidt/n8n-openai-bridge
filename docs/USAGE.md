# API Usage Guide

Complete guide for using the n8n OpenAI Bridge API.

## Table of Contents

- [API Endpoints](#api-endpoints)
- [Request Format](#request-format)
- [Code Examples](#code-examples)
- [Response Format](#response-format)

## API Endpoints

### Health Check (no auth required)

```bash
GET /health
```

### List Models

```bash
GET /v1/models
Authorization: Bearer your-secret-api-key-here
```

### Chat Completion

```bash
POST /v1/chat/completions
Authorization: Bearer your-secret-api-key-here
Content-Type: application/json

{
  "model": "my-agent",
  "messages": [
    {"role": "user", "content": "Hello!"}
  ],
  "stream": false
}
```

### Reload Models Configuration

```bash
POST /admin/reload
Authorization: Bearer your-secret-api-key-here
```

Models are also automatically reloaded when `models.json` is modified.

## Request Format

### Required Parameters

- `model` - Model ID from your `models.json`
- `messages` - Array of message objects with `role` and `content`

### Optional Parameters

- `stream` - Enable streaming mode (default: false)
- `temperature` - Forwarded to n8n (not validated)
- `max_tokens` - Forwarded to n8n (not validated)
- `session_id` - Override session ID (auto-detected if not provided)

## Code Examples

### JavaScript/TypeScript

```javascript
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: 'your-secret-api-key-here',
  baseURL: 'http://your-server:3333/v1'
});

// Non-streaming
const response = await openai.chat.completions.create({
  model: 'my-agent',
  messages: [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'Hello!' }
  ]
});

console.log(response.choices[0].message.content);

// Streaming
const stream = await openai.chat.completions.create({
  model: 'my-agent',
  messages: [{ role: 'user', content: 'Tell me a story' }],
  stream: true
});

for await (const chunk of stream) {
  process.stdout.write(chunk.choices[0]?.delta?.content || '');
}
```

### Python

```python
from openai import OpenAI

client = OpenAI(
    api_key="your-secret-api-key-here",
    base_url="http://your-server:3333/v1"
)

# Non-streaming
response = client.chat.completions.create(
    model="my-agent",
    messages=[
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user", "content": "Hello!"}
    ]
)

print(response.choices[0].message.content)

# Streaming
stream = client.chat.completions.create(
    model="my-agent",
    messages=[{"role": "user", "content": "Tell me a story"}],
    stream=True
)

for chunk in stream:
    if chunk.choices[0].delta.content is not None:
        print(chunk.choices[0].delta.content, end="")
```

### cURL

```bash
# Non-streaming
curl -X POST http://localhost:3333/v1/chat/completions \
  -H "Authorization: Bearer your-secret-api-key-here" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "my-agent",
    "messages": [
      {"role": "user", "content": "Hello!"}
    ],
    "stream": false
  }'

# Streaming
curl -N -X POST http://localhost:3333/v1/chat/completions \
  -H "Authorization: Bearer your-secret-api-key-here" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "my-agent",
    "messages": [
      {"role": "user", "content": "Hello!"}
    ],
    "stream": true
  }'

# With custom headers
curl -X POST http://localhost:3333/v1/chat/completions \
  -H "Authorization: Bearer your-secret-api-key-here" \
  -H "X-Session-Id: my-session-123" \
  -H "X-User-Id: user-456" \
  -H "X-User-Email: john@example.com" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "my-agent",
    "messages": [
      {"role": "user", "content": "Hello!"}
    ]
  }'
```

## Response Format

### n8n Webhook Response

Your n8n workflow should respond with:

- **Streaming:** JSON chunks with `content`, `text`, `output` or `message` field
- **Non-streaming:** String or JSON with one of the above fields

## API Documentation

**Complete OpenAPI 3.1 Specification:** [openapi.yaml](../openapi.yaml)

**Interactive Documentation:** Open [api.html](api.html) in your browser for Swagger UI

## Next Steps

- [Set up n8n workflow](N8N_SETUP.md)
- [Integrate with clients](INTEGRATIONS.md)
- [Configure settings](CONFIGURATION.md)
