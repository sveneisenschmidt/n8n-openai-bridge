# n8n Workflow Setup

Guide for setting up n8n workflows to work with the bridge.

## Table of Contents

- [Quick Start](#quick-start)
- [Required Node Settings](#required-node-settings)
- [Testing Your Workflow](#testing-your-workflow)

## Quick Start

Import [`n8n_workflow.json.example`](../n8n_workflow.json.example) in n8n → Configure credentials.

## Required Node Settings

### 1. When Chat Message Received (Chat Trigger)

- Mode: `Webhook`
- Response Mode: `Streaming`
- Public: Enabled
- Copy webhook URL (ends with `/chat`) → Add to `models.json`

### 2. AI Agent

- Enable Streaming: Yes (checked)

### 3. Chat Model (Anthropic, OpenAI, etc.)

- Configure with your API credentials

### 4. Memory Node (Optional)

- Use default settings - bridge passes `sessionId` automatically

## Testing Your Workflow

1. Save and activate the workflow in n8n
2. Copy the webhook URL from the Chat Trigger node
3. Add the URL to your `models.json`:

```json
{
  "test-agent": "https://n8n.example.com/webhook/abc123/chat"
}
```

4. Test the endpoint:

```bash
curl -X POST http://localhost:3333/v1/chat/completions \
  -H "Authorization: Bearer your-token" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "test-agent",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

## Next Steps

- [Configure settings](CONFIGURATION.md)
- [Integrate with clients](INTEGRATIONS.md)
- [Learn API usage](USAGE.md)
