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
Import [`n8n_workflow_chat.json`](../n8n-examples/n8n_workflow_chat.json) in n8n → Configure credentials.

**For Webhook Node (Advanced):**
Import [`n8n_workflow_webhook.json`](../n8n-examples/n8n_workflow_webhook.json) in n8n → Configure credentials.

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

## Handling Images and File Uploads

The bridge passes file uploads and images through to n8n as-is. Your workflow must handle image extraction and processing.

### How Clients Send Images

Clients like LibreChat and Open-webUI send images embedded in the message content as base64-encoded data:

```json
{
  "messages": [
    {
      "role": "user",
      "content": [
        {"type": "text", "text": "What's in this image?"},
        {
          "type": "image_url",
          "image_url": {
            "url": "data:image/jpeg;base64,/9j/4AAQSkZJRg...",
            "detail": "low"
          }
        }
      ]
    }
  ]
}
```

### Token Management for Images

The `detail` parameter controls how many tokens the image uses:

- `"low"` - 65 tokens per image (recommended)
- `"high"` - 65-765 tokens depending on image size
- `"auto"` - LLM provider decides (default, usually "high")

**Important:** If clients don't set `detail`, images may consume 500+ tokens and cause "too many tokens" errors. You can add the `detail` parameter in your n8n workflow before passing to the LLM.

### Processing Images in n8n

Your workflow needs to extract and handle images from the `messages` array. Common approaches:

**Option 1: Pass through to LLM (if supported)**
- Extract entire `messages` array
- Forward to LLM that supports vision (GPT-4V, Claude 3, etc.)
- Ensure `detail: "low"` is set to avoid token issues

**Option 2: Upload to storage**
- Extract base64 image data
- Upload to S3, Cloudinary, or similar
- Replace base64 with public URL
- Forward modified messages to LLM

**Option 3: Process locally**
- Extract image for analysis
- Use separate vision API/service
- Combine results with chat response

### Example: Setting detail Parameter in n8n

Use a Code node to ensure all images use `detail: "low"`:

```javascript
const messages = $json.messages || [];

const processedMessages = messages.map(msg => {
  if (Array.isArray(msg.content)) {
    msg.content = msg.content.map(item => {
      if (item.type === 'image_url' && item.image_url) {
        // Set detail to low if not specified
        if (!item.image_url.detail) {
          item.image_url.detail = 'low';
        }
      }
      return item;
    });
  }
  return msg;
});

return { messages: processedMessages };
```

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
