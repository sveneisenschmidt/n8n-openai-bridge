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

- Response Mode: `Streaming`
- Public: Enabled
- Copy webhook URL (ends with `/chat`)

**Important:** Chat Trigger URLs always end with `/chat`:
```
https://n8n.example.com/webhook/abc123/chat
```

This URL is used to register your model:
- **File Loader:** Add to `models.json`
- **API Loader:** Automatically discovered from n8n workflows

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

### Webhook Authentication (Optional)

If you want to secure your webhook, you can configure Bearer token authentication via the `N8N_WEBHOOK_BEARER_TOKEN` environment variable.

**Note:** This authentication method is only supported for Webhook nodes, NOT for Chat Trigger nodes.

```bash
# In your bridge configuration (.env or docker environment)
N8N_WEBHOOK_BEARER_TOKEN=your-secure-webhook-token-here
```

#### n8n Webhook Setup Steps

1. **Create Header Auth Credential in n8n:**
   - Go to: Credentials → Create New Credential
   - Type: `Header Auth`
   - Header Name: `Authorization`
   - Header Value: `Bearer your-secure-webhook-token-here`
     - Use the same token as configured in `N8N_WEBHOOK_BEARER_TOKEN`
   - Save the credential

2. **Configure Webhook Node Authentication:**
   - In your Webhook node, expand "Authentication"
   - Enable: `Header Auth`
   - Select: The Header Auth credential you created above

This ensures that only requests from your bridge (with the correct token) can trigger your webhook.

### Required Node Settings

#### 1. Webhook Node

- HTTP Method: `POST`
- Response Mode: `Streaming`
- Path: (your custom path)
- Authentication: `Header Auth` (optional, see [Webhook Authentication](#webhook-authentication-optional) above)
- Copy webhook URL

**Important:** Webhook URLs do NOT end with `/chat`:
```
https://n8n.example.com/webhook/xyz789
```

This URL is used to register your model:
- **File Loader:** Add to `models.json`
- **API Loader:** Automatically discovered from n8n workflows

#### 2. Extract Chat Body (Set Node)

**IMPORTANT:** This node is required to extract the chat data from the webhook body.

- Mode: `JSON`
- JSON Output (Expression): `={{ $json.body }}`

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
2. Copy the webhook URL from the Chat Trigger or Webhook node
3. Register the model:
   - **File Loader:** Add to your `models.json`:
     ```json
     {
       "test-agent": "https://n8n.example.com/webhook/abc123/chat"
     }
     ```
   - **API Loader:** Tag your workflow with `n8n-openai-bridge` (or your configured tag) - the model will be automatically discovered

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
