# How to: Auto-Restart Containers on Bridge Events

Automatically trigger container restarts or other actions when the n8n-openai-bridge detects model changes or other events.

## Overview

This is a **universal automation pattern** for responding to n8n-openai-bridge webhook events. When model availability changes (models loaded/unloaded/changed), you may want to:
- Restart services (LibreChat, Open WebUI, etc.) to refresh their model list
- Trigger deployments or configuration updates
- Run maintenance tasks
- Sync data between services

This example uses n8n with Portainer to demonstrate the pattern, but the concept is universally applicable to any Docker container or external system.

### How It Works

The n8n-openai-bridge sends **webhook notifications** when:
- `models_loaded` - Models have been loaded into the bridge
- `models_changed` - Available models have changed
- Other custom events

Your n8n workflow receives these webhook events and can trigger any automation:
1. Receives webhook event from the bridge
2. Filters/routes based on event type
3. Takes action (restart container, call API, send notification, etc.)
4. Returns response to bridge

The workflow:
1. Receives `models_loaded` or `models_changed` webhook events from the bridge
2. Queries Portainer API to list containers
3. Filters for target container(s) by image name or label
4. Takes action (restart, redeploy, etc.)

## Prerequisites

- n8n instance with access to Portainer API
- Portainer personal access token (for API authentication)
- LibreChat container running via Docker/Portainer
- n8n-openai-bridge configured to send webhook notifications

## Step-by-Step Setup

### 1. Create Portainer Credentials in n8n

1. Go to **Credentials** in n8n
2. Create a new credential of type **Header Auth**
3. Fill in the details:
   - **Name:** `Portainer Personal Access Token`
   - **Header Name:** `X-API-Key`
   - **Header Value:** Your Portainer personal access token
4. Save the credential

**How to get your Portainer API token:**
- Login to Portainer
- Go to Settings → Account → API Tokens
- Click "Generate API Token"
- Copy the token and use it in the Header Auth credential

### 2. Create the n8n Workflow

#### 2.1 Add Webhook Node

1. In n8n, click **Create New Workflow**
2. Add a **Webhook** node:
   - HTTP Method: `POST`
   - Response Mode: `Streaming` (or your preference)
   - Copy the webhook URL for later

#### 2.2 Add Switch Node

Add a **Switch** node to filter event types:
- **Condition 1:** `body.type` equals `models_loaded`
- **Condition 2:** `body.type` equals `models_changed`
- **Default:** Stop and Error with message "Unsupported Webhook Method"

#### 2.3 Add "Get All Containers" HTTP Request

After the Switch node (both outputs 0 and 1), add an **HTTP Request** node:
- **Method:** `POST`
- **URL:** `https://your-portainer-url/api/endpoints/3/docker/containers/json`
- **Authentication:** Select your Portainer credential
- **Options:** Enable "Allow Unauthorized Certificates" if needed

**Note:** Replace:
- `your-portainer-url` with your actual Portainer URL
- `3` in `/endpoints/3/` with your endpoint ID (check in Portainer)

#### 2.4 Add Data Table Node

Add a **Data Table** node to define which containers to manage:
- Create a table with columns:
  - `image`: Container image name to filter by
  - `action`: Action to take (e.g., "restart", "stop", "redeploy")
  - `enabled`: Boolean to enable/disable this rule

Example data:
```
| image                               | action  | enabled |
|-------------------------------------|---------|---------|
| ghcr.io/danny-avila/librechat:*     | restart | true    |
| ghcr.io/open-webui/open-webui:*     | restart | true    |
| my-custom-service:latest            | restart | true    |
```

**Benefits of Data Table approach:**
- Easily add/remove containers without editing workflow logic
- Reuse same workflow for multiple services
- Maintain configuration in UI instead of hardcoding
- Support wildcards for flexible image matching

#### 2.5 Add Loop Over Items Node

Add a **Loop** node to iterate over your Data Table rows:
- Loop source: Select your Data Table node
- This processes each container rule in sequence

#### 2.6 Add Filter Node (inside loop)

Add a **Filter** node to match containers by image:
- Filter condition: `$loopData.item.image` (from Data Table)
- Match containers returned from "Get All Containers"
- Support wildcard matching if image ends with `*`

**Note:** You can now manage multiple container types in one workflow!

#### 2.7 Add Switch Node (inside loop)

Add a **Switch** node to route by action type:
- Case 1: `action` equals `restart` → HTTP Request to restart
- Case 2: `action` equals `stop` → HTTP Request to stop
- Default: Skip

#### 2.8 Add "Restart Container" HTTP Request

Add an **HTTP Request** node for restart action:
- **Method:** `POST`
- **URL:** `=https://your-portainer-url/api/endpoints/3/docker/v1.41/containers/{{ $json.Id }}/restart`
- **Authentication:** Select your Portainer credential
- **Options:** Enable "Allow Unauthorized Certificates" if needed

#### 2.9 Add "Stop Container" HTTP Request (optional)

Add another **HTTP Request** node for stop action:
- **Method:** `POST`
- **URL:** `=https://your-portainer-url/api/endpoints/3/docker/v1.41/containers/{{ $json.Id }}/stop`
- **Authentication:** Select your Portainer credential
- **Options:** Enable "Allow Unauthorized Certificates" if needed

#### 2.10 Connect All Nodes

Wire the nodes together:
```
Webhook
   ↓
Switch (filter event type)
   ├→ Get All Containers
   └→ Get All Containers
        ↓
    Data Table (configuration)
        ↓
    Loop Over Items
        ↓
    Filter (match image)
        ↓
    Switch (action type)
     ├→ Restart Container
     └→ Stop Container
```

This modular design allows you to:
- Add/remove containers by editing the Data Table (no workflow logic changes)
- Support multiple actions per container
- Easily extend for other services and automation tasks

### 3. Save and Activate Workflow

1. Click **Save** to save your workflow
2. Click the **Activate** toggle to enable it
3. The webhook URL is now active and ready to receive events

### 4. Configure Bridge Webhook Notification

This is the critical step that connects your bridge to n8n. Tell your bridge where to send webhook notifications by setting environment variables.

#### 4.1 Set Environment Variables

In your bridge configuration (`.env` or Docker environment), set:

```bash
# Required: Where to send webhook notifications
WEBHOOK_NOTIFIER_URL=https://your-n8n-url/webhook/your-webhook-id

# Optional: Advanced configuration
WEBHOOK_NOTIFIER_TIMEOUT=5000              # Request timeout (ms), default: 5000
WEBHOOK_NOTIFIER_RETRIES=3                 # Retry attempts, default: 3
WEBHOOK_NOTIFIER_BEARER_TOKEN=your-token   # Auth token if webhook is protected
WEBHOOK_NOTIFIER_ON_STARTUP=true           # Send event on bridge startup
```

**Docker Compose example:**
```yaml
services:
  n8n-bridge:
    image: your-bridge-image
    environment:
      WEBHOOK_NOTIFIER_URL: https://your-n8n-instance.com/webhook/model-changes
      WEBHOOK_NOTIFIER_ON_STARTUP: "true"
      WEBHOOK_NOTIFIER_BEARER_TOKEN: your-optional-auth-token
```

#### 4.2 How the Bridge Webhook Works

When the bridge starts or detects model changes, it sends a POST request to your webhook:

**Event: `models_loaded` (on startup)**
```json
{
  "type": "models_loaded",
  "timestamp": "2025-10-26T12:00:00.000Z",
  "source": "JsonFileModelLoader",
  "models": {
    "librechat-agent": "https://n8n.example.com/webhook/abc123/chat",
    "webui-agent": "https://n8n.example.com/webhook/xyz789"
  },
  "modelCount": 2
}
```

**Event: `models_changed` (when models are added/removed)**
```json
{
  "type": "models_changed",
  "timestamp": "2025-10-26T12:05:00.000Z",
  "source": "JsonFileModelLoader",
  "models": {
    "librechat-agent": "https://n8n.example.com/webhook/abc123/chat",
    "webui-agent": "https://n8n.example.com/webhook/xyz789",
    "new-model": "https://n8n.example.com/webhook/new456"
  },
  "modelCount": 3
}
```

The bridge automatically retries with exponential backoff (1s, 2s, 4s) if the webhook fails.

#### 4.3 Verify Configuration

Check your bridge logs to confirm the webhook is configured:

```bash
# Look for these log entries
# ✓ "Webhook Notifier URL configured: https://..."
# ✓ "Webhook notification sent successfully"
# ✗ "Failed to send webhook notification" (check your webhook URL)
```

For complete configuration details, see [Bridge Configuration - Webhook Notifier](../CONFIGURATION.md#webhook-notifier).

### 5. Configure Your Containers in Data Table

1. Click on your **Data Table** node
2. Add rows for each container you want to automate:

**Example configuration:**
```
| image                               | action  | enabled |
|-------------------------------------|---------|---------|
| ghcr.io/danny-avila/librechat:*     | restart | true    |
| ghcr.io/open-webui/open-webui:*     | restart | true    |
```

The `*` acts as a wildcard - it matches any version of that image.

3. Save the workflow

### 6. Test the Workflow

#### Manual Test in n8n:

1. Open your workflow in n8n
2. Click the **Test** button
3. Send a test payload in the Webhook node:
```json
{
  "type": "models_loaded",
  "models": ["gpt-4", "gpt-3.5-turbo"]
}
```

4. Check execution history to see which containers were matched and actioned
5. Verify in Portainer that containers were restarted

#### From the Bridge:

1. Trigger a model change (e.g., load a new model in your model loader)
2. The bridge will automatically send a webhook event
3. Check n8n's execution history to verify the workflow ran
4. Check which containers were restarted via the Data Table configuration

## Complete Workflow - Data Table Approach

This workflow uses n8n's Data Table feature for flexible container management. Key features:
- **No hardcoding** of container images in workflow logic
- **Easy configuration** - add/remove containers by editing the Data Table
- **Reusable** - works with any container image
- **Extensible** - supports multiple actions per container

### Data Table Structure

First, set up your Data Table with these columns:

| image | action | enabled |
|-------|--------|---------|
| `ghcr.io/danny-avila/librechat:*` | `restart` | `true` |
| `ghcr.io/open-webui/open-webui:*` | `restart` | `true` |

**Column definitions:**
- **image**: Container image name (supports `*` wildcard for versions)
- **action**: Action to perform (`restart`, `stop`, `redeploy`, etc.)
- **enabled**: Boolean to enable/disable the rule without removing it

### Workflow Logic

```
Webhook (receive bridge event)
   ↓
Switch (filter: models_loaded or models_changed)
   ├→ Get All Containers (from Portainer API)
      ↓
      Data Table (container rules)
      ↓
      Loop Over Items (iterate each rule)
         ↓
         Filter (match image with wildcard support)
         ↓
         Switch (route by action)
            ├→ Restart Container (HTTP POST)
            ├→ Stop Container (HTTP POST)
            └→ ...other actions
```

### Example Workflow JSON (Simplified Structure)

For the complete JSON, you can:
1. **Build it manually** in n8n following the steps in Section 2 above
2. **Use this reference** to understand the node structure:

```json
{
  "nodes": [
    {
      "name": "Webhook",
      "type": "n8n-nodes-base.webhook",
      "parameters": {
        "httpMethod": "POST",
        "path": "bridge-webhook"
      }
    },
    {
      "name": "Filter Event Type",
      "type": "n8n-nodes-base.switch",
      "parameters": {
        "rules": {
          "values": [
            {
              "conditions": {
                "conditions": [
                  {
                    "leftValue": "={{ $json.body.type }}",
                    "rightValue": "models_loaded",
                    "operator": {"type": "string", "operation": "equals"}
                  }
                ]
              }
            },
            {
              "conditions": {
                "conditions": [
                  {
                    "leftValue": "={{ $json.body.type }}",
                    "rightValue": "models_changed",
                    "operator": {"type": "string", "operation": "equals"}
                  }
                ]
              }
            }
          ]
        }
      }
    },
    {
      "name": "Get All Containers",
      "type": "n8n-nodes-base.httpRequest",
      "parameters": {
        "method": "POST",
        "url": "https://your-portainer-url/api/endpoints/3/docker/containers/json",
        "authentication": "genericCredentialType",
        "genericAuthType": "httpHeaderAuth"
      }
    },
    {
      "name": "Container Rules (Data Table)",
      "type": "n8n-nodes-base.dataTable",
      "parameters": {
        "data": [
          {
            "image": "ghcr.io/danny-avila/librechat:*",
            "action": "restart",
            "enabled": true
          }
        ]
      }
    },
    {
      "name": "Loop Over Rules",
      "type": "n8n-nodes-base.loop",
      "parameters": {
        "loopSource": "Container Rules (Data Table)"
      }
    },
    {
      "name": "Match Container Image",
      "type": "n8n-nodes-base.filter",
      "parameters": {
        "conditions": {
          "conditions": [
            {
              "leftValue": "={{ $json.Image }}",
              "rightValue": "={{ $loopData.item.image }}",
              "operator": {"type": "string", "operation": "contains"}
            }
          ]
        }
      }
    },
    {
      "name": "Route by Action",
      "type": "n8n-nodes-base.switch",
      "parameters": {
        "rules": {
          "values": [
            {
              "conditions": {
                "conditions": [
                  {
                    "leftValue": "={{ $loopData.item.action }}",
                    "rightValue": "restart",
                    "operator": {"type": "string", "operation": "equals"}
                  }
                ]
              }
            }
          ]
        }
      }
    },
    {
      "name": "Restart Container",
      "type": "n8n-nodes-base.httpRequest",
      "parameters": {
        "method": "POST",
        "url": "=https://your-portainer-url/api/endpoints/3/docker/v1.41/containers/{{ $json.Id }}/restart",
        "authentication": "genericCredentialType",
        "genericAuthType": "httpHeaderAuth"
      }
    }
  ]
}
```

**Note:** This is a simplified structure. Build the complete workflow in n8n UI for best results.

## Troubleshooting

### "Container not found"
- Verify the LibreChat image name matches exactly (including tag)
- In Portainer: go to Containers → find your container → Details → Image
- Update the filter condition in the Filter node if the image name is different

### "Unauthorized" error from Portainer
- Verify your API token is correct and hasn't expired
- Check token has sufficient permissions in Portainer
- Verify the endpoint ID (e.g., `/endpoints/3/`) matches your setup

### Webhook not triggering
- Verify the webhook URL is correctly set in `WEBHOOK_NOTIFIER_URL`
- Check n8n logs for incoming requests
- Test manually first by clicking the test button in the Webhook node

### Container restarts but models don't refresh
- LibreChat may cache models - check LibreChat configuration
- Verify model fetch is enabled in LibreChat config (`fetch: true`)
- Check LibreChat logs to see if it's connecting to the bridge correctly

## See Also

- [n8n Workflow Setup](../N8N_SETUP.md)
- [Integration Guide](../INTEGRATIONS.md)
- [Webhook Notifier Documentation](../CONFIGURATION.md#webhook-notifier)
