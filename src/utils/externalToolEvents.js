const { randomUUID } = require('crypto');

const EXTERNAL_TOOL_EVENT_OBJECT = 'chat.completion.external_tool';
const EXTERNAL_EXECUTION_ARGUMENT_KEY = '__librechat_external_execution';

function withExternalExecutionArgument(argumentsValue) {
  try {
    const parsed = JSON.parse(argumentsValue || '{}');
    if (parsed === null || Array.isArray(parsed) || typeof parsed !== 'object') {
      return argumentsValue || '';
    }
    return JSON.stringify({
      ...parsed,
      [EXTERNAL_EXECUTION_ARGUMENT_KEY]: { mode: 'external', provider: 'workflow-engine' },
    });
  } catch {
    return argumentsValue || '';
  }
}

function createExternalToolEvent(model, toolCall, index, status = 'running') {
  const id = toolCall?.id || `external-tool-${randomUUID()}`;
  const name = String(toolCall?.function?.name || 'external_tool');
  const argumentsValue = toolCall?.function?.arguments || '';

  return {
    id,
    object: EXTERNAL_TOOL_EVENT_OBJECT,
    created: Math.floor(Date.now() / 1000),
    model,
    index,
    name,
    arguments: argumentsValue,
    execution: {
      mode: 'external',
      provider: 'workflow-engine',
    },
    status,
  };
}

function createToolCallChunk(model, toolCall, index) {
  return {
    id: `chatcmpl-${randomUUID()}`,
    object: 'chat.completion.chunk',
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [
      {
        index: 0,
        delta: {
          role: 'assistant',
          tool_calls: [
            {
              index,
              id: toolCall.id,
              type: toolCall.type || 'function',
              execution: {
                mode: 'external',
                provider: 'workflow-engine',
              },
              function: {
                name: toolCall.function?.name || '',
                // LangChain currently drops custom properties on streamed
                // tool-call records. This trusted, namespaced fallback survives
                // normal argument parsing and is removed by LibreChat before any
                // local dispatch decision. The original executor never receives
                // this injected client-only delta.
                arguments: withExternalExecutionArgument(toolCall.function?.arguments),
              },
            },
          ],
        },
        finish_reason: null,
      },
    ],
  };
}

function writeSSE(res, event) {
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

function getExternalToolCalls(registry, streamId) {
  return registry.get(streamId)?.externalToolCalls ?? [];
}

function emitExternalToolCalls(registry, streamId, model, toolCalls) {
  const activeStream = registry.get(streamId);
  if (!activeStream || activeStream.res.writableEnded || activeStream.res.destroyed) {
    return false;
  }

  toolCalls.forEach((toolCall, index) => {
    if (!toolCall?.id || activeStream.externalToolCallIds.has(toolCall.id)) {
      return;
    }

    activeStream.externalToolCallIds.add(toolCall.id);
    activeStream.externalToolCalls.push({
      id: toolCall.id,
      index,
      name: toolCall.function?.name || '',
      arguments: toolCall.function?.arguments || '',
    });
    writeSSE(
      activeStream.res,
      createExternalToolEvent(activeStream.model || model, toolCall, index),
    );
    writeSSE(activeStream.res, createToolCallChunk(activeStream.model || model, toolCall, index));
  });
  activeStream.res.flush?.();
  return true;
}

function emitExternalToolCompletions(registry, streamId) {
  const activeStream = registry.get(streamId);
  if (!activeStream || activeStream.res.writableEnded || activeStream.res.destroyed) {
    return false;
  }

  for (const toolCall of getExternalToolCalls(registry, streamId)) {
    if (activeStream.completedExternalToolCallIds.has(toolCall.id)) {
      continue;
    }
    activeStream.completedExternalToolCallIds.add(toolCall.id);
    writeSSE(
      activeStream.res,
      createExternalToolEvent(
        activeStream.model,
        {
          id: toolCall.id,
          function: { name: toolCall.name, arguments: toolCall.arguments },
        },
        toolCall.index,
        'completed',
      ),
    );
  }
  activeStream.res.flush?.();
  return true;
}

module.exports = {
  EXTERNAL_TOOL_EVENT_OBJECT,
  EXTERNAL_EXECUTION_ARGUMENT_KEY,
  createExternalToolEvent,
  createToolCallChunk,
  emitExternalToolCalls,
  emitExternalToolCompletions,
};
