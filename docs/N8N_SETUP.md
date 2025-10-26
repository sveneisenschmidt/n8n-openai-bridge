# n8n Workflow Setup

Guide for setting up n8n workflows to work with the bridge.

## Table of Contents

- [Supported Node Types](#supported-node-types)
- [Quick Start](#quick-start)
- [Option 1: Chat Trigger Node (Recommended)](#option-1-chat-trigger-node-recommended)
- [Option 2: Webhook Node (Advanced)](#option-2-webhook-node-advanced)
- [Testing Your Workflow](#testing-your-workflow)

## Supported Node Types

The bridge supports two types of n8n nodes for receiving chat requests:

1. **Chat Trigger Node** (`@n8n/n8n-nodes-langchain.chatTrigger`) - Recommended, simpler setup
2. **Webhook Node** (`n8n-nodes-base.webhook`) - Advanced, requires body extraction

## Quick Start

**For Chat Trigger (Recommended):**
Import [`n8n_workflow_chat.json.example`](../n8n_workflow_chat.json.example) in n8n → Configure credentials.

**For Webhook Node (Advanced):**
Import [`n8n_workflow_webhook.json.example`](../n8n_workflow_webhook.json.example) in n8n → Configure credentials.

## Option 1: Chat Trigger Node (Recommended)

This is the simplest approach using n8n's dedicated Chat Trigger node.

### Required Node Settings

#### 1. When Chat Message Received (Chat Trigger)

- Mode: `Webhook`
- Response Mode: `Streaming`
- Public: Enabled
- Copy webhook URL (ends with `/chat`) → Add to `models.json`

#### 2. AI Agent

- Enable Streaming: Yes (checked)

#### 3. Chat Model (Anthropic, OpenAI, etc.)

- Configure with your API credentials

#### 4. Memory Node (Optional)

- Use default settings - bridge passes `sessionId` automatically

### Example Workflow Structure

```
When Chat Message Received → AI Agent → (Response)
                               ↓
                         Chat Model
                               ↓
                         Memory (Optional)
```

## Option 2: Webhook Node (Advanced)

Use this approach if you need more control or want to use a standard webhook node.

### Required Node Settings

#### 1. Webhook Node

- HTTP Method: `POST`
- Response Mode: `Streaming`
- Path: (your custom path)
- Options → Raw Body: Enabled
- Copy webhook URL → Add to `models.json`

#### 2. Extract Chat Body (Set Node)

**IMPORTANT:** This node is required to extract the chat data from the webhook body.

- Mode: `JSON`
- JSON Output: `={{ $json.body }}`

This extracts the chat request data (messages, sessionId, etc.) from the webhook body and makes it available to the AI Agent.

#### 3. AI Agent

- Prompt Type: `Define Below`
- Text: `={{ $json.chatInput }}`
- Enable Streaming: Yes (checked)

#### 4. Chat Model (Anthropic, OpenAI, etc.)

- Configure with your API credentials

### Example Workflow Structure

```
Webhook → Extract Chat Body → AI Agent → (Response)
                                 ↓
                           Chat Model
```

### Why the "Extract Chat Body" Node?

The Webhook node receives the entire HTTP request in `$json`, with the actual chat data nested in `$json.body`. The "Extract Chat Body" node (a Set node) extracts this nested data and flattens it, making fields like `chatInput` and `sessionId` directly accessible to the AI Agent.

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
