# How To: Use Task Detection in n8n Workflows

Task detection automatically identifies automated generation requests (title, tags, follow-up questions) from OpenWebUI and LibreChat, adding `isTask` and `taskType` fields to the webhook payload.

## Prerequisites

Enable task detection in your bridge configuration:

```bash
ENABLE_TASK_DETECTION=true
```

## Example 1: Route Tasks to Different AI Agents

Use an **IF node** to route task generation requests to specialized agents:

```
Webhook Trigger
    ↓
IF Node: {{ $json.isTask }}
    ├─ TRUE  → Specialized Task Agent (fast, simple model)
    └─ FALSE → Regular Conversation Agent (full context)
```

**IF Node Configuration:**
- Condition: `{{ $json.isTask }}` equals `true`
- True branch: Connect to task-optimized AI node
- False branch: Connect to regular conversation AI node

## Example 2: Separate Memory Storage by Task Type

Use **Memory Store nodes** to keep task generations separate from conversations:

**Memory Key Expression:**
```javascript
{{ !$json.isTask ? $json.sessionId : `${$json.taskType}-${$json.sessionId}` }}
```

**Results:**
- Normal conversation: `session-abc123`
- Title generation: `generate_title-session-abc123`
- Tags generation: `generate_tags-session-abc123`
- Follow-up questions: `generate_follow_up_questions-session-abc123`

**Why?** This prevents task generation context from polluting regular conversation memory.

## Available Task Types

| `taskType` Value | Description | Clients |
|------------------|-------------|---------|
| `generate_title` | Title generation | OpenWebUI, LibreChat |
| `generate_tags` | Tags generation | OpenWebUI |
| `generate_follow_up_questions` | Follow-up questions | OpenWebUI |
| `null` | Normal conversation | All |

## Complete Workflow Example

```
1. Webhook Trigger (receives request from bridge)
2. IF Node: Check isTask
   ├─ TRUE:
   │   ├─ Memory Node (key: taskType + "-" + sessionId)
   │   └─ Fast AI Model (gpt-3.5-turbo)
   └─ FALSE:
       ├─ Memory Node (key: sessionId)
       └─ Advanced AI Model (gpt-4)
3. Return response to bridge
```

## Tips

- **Performance:** Use faster/cheaper models for task generation
- **Context:** Task requests don't need full conversation history
- **Memory:** Separate storage prevents context pollution
- **Routing:** Different system prompts for tasks vs. conversations

## Related

- [Configuration Guide](../CONFIGURATION.md#task-detection) - Enable task detection
- [n8n Setup](../N8N_SETUP.md) - Webhook configuration
