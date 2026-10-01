const {
  EXTERNAL_EXECUTION_ARGUMENT_KEY,
  createExternalToolEvent,
  createToolCallChunk,
  emitExternalToolCalls,
  emitExternalToolCompletions,
} = require('../src/utils/externalToolEvents');
const { getStreamId } = require('../src/routes/openaiToolProxy');

describe('OpenAI-compatible tool proxy external-tool streaming', () => {
  const toolCall = {
    id: 'call_weather',
    type: 'function',
    function: { name: 'get_weather', arguments: '{"city":"Utrecht"}' },
  };

  function createRegistryEntry(model = 'agent-model') {
    const writes = [];
    return {
      writes,
      entry: {
        model,
        res: {
          writableEnded: false,
          destroyed: false,
          write: (event) => writes.push(event),
          flush: jest.fn(),
        },
        externalToolCalls: [],
        externalToolCallIds: new Set(),
        completedExternalToolCallIds: new Set(),
      },
    };
  }

  test('uses the original name and carries explicit external execution metadata', () => {
    const chunk = createToolCallChunk('agent-model', toolCall, 2);

    expect(chunk.object).toBe('chat.completion.chunk');
    expect(chunk.model).toBe('agent-model');
    expect(chunk.choices[0].delta.tool_calls[0]).toEqual({
      index: 2,
      id: 'call_weather',
      type: 'function',
      execution: { mode: 'external', provider: 'workflow-engine' },
      function: {
        name: 'get_weather',
        arguments: JSON.stringify({
          city: 'Utrecht',
          [EXTERNAL_EXECUTION_ARGUMENT_KEY]: { mode: 'external', provider: 'workflow-engine' },
        }),
      },
    });
  });

  test('marks a mock upstream tool call without modifying its visible name', () => {
    const externalTool = {
      id: 'call_mock_tool',
      type: 'function',
      function: {
        name: 'mock_upstream_tool',
        arguments: '{"input":"example input"}',
      },
    };

    const chunk = createToolCallChunk('agent-model', externalTool, 0);
    const emitted = chunk.choices[0].delta.tool_calls[0];

    expect(emitted.function.name).toBe('mock_upstream_tool');
    expect(JSON.parse(emitted.function.arguments)).toMatchObject({
      input: 'example input',
      [EXTERNAL_EXECUTION_ARGUMENT_KEY]: { mode: 'external', provider: 'workflow-engine' },
    });
  });

  test('correlates a running metadata event, a native tool-call delta, and completion by call id', () => {
    const { writes, entry } = createRegistryEntry();
    const registry = new Map([['stream-a', entry]]);

    expect(emitExternalToolCalls(registry, 'stream-a', 'agent-model', [toolCall])).toBe(true);
    expect(emitExternalToolCompletions(registry, 'stream-a')).toBe(true);

    expect(writes).toHaveLength(3);
    const [running, delta, completed] = writes.map((event) => JSON.parse(event.slice(6)));
    expect(running).toMatchObject({
      object: 'chat.completion.external_tool',
      id: 'call_weather',
      name: 'get_weather',
      status: 'running',
      execution: { mode: 'external', provider: 'workflow-engine' },
    });
    expect(delta.choices[0].delta.tool_calls[0].function.name).toBe('get_weather');
    expect(completed).toMatchObject({
      object: 'chat.completion.external_tool',
      id: 'call_weather',
      status: 'completed',
    });
  });

  test('does not duplicate an already emitted tool call or completion', () => {
    const { writes, entry } = createRegistryEntry();
    const registry = new Map([['stream-a', entry]]);

    emitExternalToolCalls(registry, 'stream-a', 'agent-model', [toolCall]);
    emitExternalToolCalls(registry, 'stream-a', 'agent-model', [toolCall]);
    emitExternalToolCompletions(registry, 'stream-a');
    emitExternalToolCompletions(registry, 'stream-a');

    expect(writes).toHaveLength(3);
  });

  test('creates independently correlated events for parallel calls', () => {
    const { writes, entry } = createRegistryEntry();
    const registry = new Map([['stream-a', entry]]);
    const secondToolCall = {
      ...toolCall,
      id: 'call_calendar',
      function: { name: 'get_calendar', arguments: '{"day":"tomorrow"}' },
    };

    emitExternalToolCalls(registry, 'stream-a', 'agent-model', [toolCall, secondToolCall]);

    expect(writes).toHaveLength(4);
    const events = writes.map((event) => JSON.parse(event.slice(6)));
    expect(events.map((event) => event.id)).toEqual([
      'call_weather',
      expect.any(String),
      'call_calendar',
      expect.any(String),
    ]);
    expect(events[1].choices[0].delta.tool_calls[0].index).toBe(0);
    expect(events[3].choices[0].delta.tool_calls[0].index).toBe(1);
  });

  test('does not write after the LibreChat stream has closed', () => {
    const write = jest.fn();
    const registry = new Map([
      [
        'ended',
        {
          model: 'model-a',
          res: { writableEnded: true, destroyed: false, write },
          externalToolCalls: [],
          externalToolCallIds: new Set(),
          completedExternalToolCallIds: new Set(),
        },
      ],
    ]);

    expect(emitExternalToolCalls(registry, 'ended', 'model-a', [toolCall])).toBe(false);
    expect(write).not.toHaveBeenCalled();
  });

  test('creates a standards-compatible metadata event with an explicit running status', () => {
    expect(createExternalToolEvent('agent-model', toolCall, 0)).toMatchObject({
      object: 'chat.completion.external_tool',
      id: 'call_weather',
      index: 0,
      status: 'running',
    });
  });

  test('uses only the explicit X-Stream-Id header for stream correlation', () => {
    expect(
      getStreamId({ get: (name) => (name === 'x-stream-id' ? ' stream-123 ' : undefined) }),
    ).toBe('stream-123');
    expect(getStreamId({ get: () => undefined })).toBeNull();
  });
});
