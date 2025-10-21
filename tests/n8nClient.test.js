const axios = require('axios');

// Mock console methods to reduce noise in test output
global.console = {
  ...console,
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Mock axios
jest.mock('axios');

const N8nClient = require('../src/n8nClient');

describe('N8nClient', () => {
  let client;
  let mockConfig;

  beforeEach(() => {
    jest.clearAllMocks();
    mockConfig = {
      n8nBearerToken: '',
    };
    client = new N8nClient(mockConfig);
  });

  describe('getHeaders', () => {
    test('should return headers with Authorization when token is set', () => {
      mockConfig.n8nWebhookBearerToken = 'test-token';

      const headers = client.getHeaders();

      expect(headers).toHaveProperty('Content-Type', 'application/json');
      expect(headers).toHaveProperty('Authorization', 'Bearer test-token');
    });

    test('should return headers without Authorization when token is empty', () => {
      mockConfig.n8nWebhookBearerToken = '';

      const headers = client.getHeaders();

      expect(headers).toHaveProperty('Content-Type', 'application/json');
      expect(headers).not.toHaveProperty('Authorization');
    });
  });

  describe('buildPayload', () => {
    test('should build payload with system prompt and current message', () => {
      const messages = [
        { role: 'system', content: 'You are a helpful assistant' },
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' },
        { role: 'user', content: 'How are you?' },
      ];

      const userContext = {
        userId: 'user-456',
        userEmail: 'user@example.com',
        userName: 'John Doe',
        userRole: 'admin',
      };

      const payload = client.buildPayload(messages, 'session-123', userContext);

      expect(payload.systemPrompt).toBe('You are a helpful assistant');
      expect(payload.currentMessage).toBe('How are you?');
      expect(payload.chatInput).toBe('How are you?');
      expect(payload.sessionId).toBe('session-123');
      expect(payload.userId).toBe('user-456');
      expect(payload.userEmail).toBe('user@example.com');
      expect(payload.userName).toBe('John Doe');
      expect(payload.userRole).toBe('admin');
    });

    test('should filter out system messages from messages array', () => {
      const messages = [
        { role: 'system', content: 'System prompt' },
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi!' },
      ];

      const userContext = { userId: 'user-456' };
      const payload = client.buildPayload(messages, 'session-123', userContext);

      expect(payload.messages).toHaveLength(2);
      expect(payload.messages.every((m) => m.role !== 'system')).toBe(true);
    });

    test('should handle empty messages array', () => {
      const userContext = { userId: 'user-456' };
      const payload = client.buildPayload([], 'session-123', userContext);

      expect(payload.systemPrompt).toBe('');
      expect(payload.currentMessage).toBe('');
      expect(payload.messages).toEqual([]);
    });

    test('should only include userId when other user fields are null', () => {
      const messages = [{ role: 'user', content: 'Hello' }];

      const userContext = {
        userId: 'user-456',
        userEmail: null,
        userName: null,
        userRole: null,
      };

      const payload = client.buildPayload(messages, 'session-123', userContext);

      expect(payload.userId).toBe('user-456');
      expect(payload).not.toHaveProperty('userEmail');
      expect(payload).not.toHaveProperty('userName');
      expect(payload).not.toHaveProperty('userRole');
    });

    test('should include only provided optional user fields', () => {
      const messages = [{ role: 'user', content: 'Hello' }];

      const userContext = {
        userId: 'user-456',
        userEmail: 'user@example.com',
        userName: null,
        userRole: 'admin',
      };

      const payload = client.buildPayload(messages, 'session-123', userContext);

      expect(payload.userId).toBe('user-456');
      expect(payload.userEmail).toBe('user@example.com');
      expect(payload).not.toHaveProperty('userName');
      expect(payload.userRole).toBe('admin');
    });
  });

  describe('nonStreamingCompletion', () => {
    test('should collect and return complete streamed response', async () => {
      // Mock a stream response from n8n
      const mockStream = {
        async *[Symbol.asyncIterator]() {
          yield Buffer.from('{"type":"begin","metadata":{}}');
          yield Buffer.from('{"type":"item","content":"Hello "}');
          yield Buffer.from('{"type":"item","content":"World"}');
          yield Buffer.from('{"type":"end","metadata":{}}');
        },
      };

      axios.post.mockResolvedValue({
        data: mockStream,
      });

      const userContext = { userId: 'user-456' };
      const result = await client.nonStreamingCompletion(
        'https://n8n.example.com/webhook/test/chat',
        [{ role: 'user', content: 'Hello' }],
        'session-123',
        userContext,
      );

      expect(result).toBe('Hello World');
    });

    test('should handle single chunk response', async () => {
      const mockStream = {
        async *[Symbol.asyncIterator]() {
          yield Buffer.from('{"type":"item","content":"Complete response"}');
          yield Buffer.from('{"type":"end"}');
        },
      };

      axios.post.mockResolvedValue({
        data: mockStream,
      });

      const userContext = { userId: 'user-456' };
      const result = await client.nonStreamingCompletion(
        'https://n8n.example.com/webhook/test/chat',
        [{ role: 'user', content: 'Hello' }],
        'session-123',
        userContext,
      );

      expect(result).toBe('Complete response');
    });

    test('should handle response with different content fields', async () => {
      const mockStream = {
        async *[Symbol.asyncIterator]() {
          yield Buffer.from('{"output":"Part 1 "}');
          yield Buffer.from('{"text":"Part 2 "}');
          yield Buffer.from('{"message":"Part 3"}');
        },
      };

      axios.post.mockResolvedValue({
        data: mockStream,
      });

      const userContext = { userId: 'user-456' };
      const result = await client.nonStreamingCompletion(
        'https://n8n.example.com/webhook/test/chat',
        [{ role: 'user', content: 'Hello' }],
        'session-123',
        userContext,
      );

      expect(result).toBe('Part 1 Part 2 Part 3');
    });

    test('should handle errors gracefully', async () => {
      axios.post.mockRejectedValue(new Error('Network error'));

      const userContext = { userId: 'user-456' };
      await expect(
        client.nonStreamingCompletion(
          'https://n8n.example.com/webhook/test/chat',
          [{ role: 'user', content: 'Hello' }],
          'session-123',
          userContext,
        ),
      ).rejects.toThrow('Network error');
    });
  });

  describe('extractJsonChunks', () => {
    test('should extract single JSON object', () => {
      const buffer = '{"content":"Hello"}';
      const result = client.extractJsonChunks(buffer);

      expect(result.extracted).toHaveLength(1);
      expect(result.extracted[0]).toBe('{"content":"Hello"}');
      expect(result.remainder).toBe('');
    });

    test('should extract multiple JSON objects', () => {
      const buffer = '{"content":"Hello"}{"content":"World"}';
      const result = client.extractJsonChunks(buffer);

      expect(result.extracted).toHaveLength(2);
      expect(result.extracted[0]).toBe('{"content":"Hello"}');
      expect(result.extracted[1]).toBe('{"content":"World"}');
    });

    test('should handle nested JSON objects', () => {
      const buffer = '{"data":{"nested":"value"}}';
      const result = client.extractJsonChunks(buffer);

      expect(result.extracted).toHaveLength(1);
      expect(result.extracted[0]).toBe('{"data":{"nested":"value"}}');
    });

    test('should keep incomplete JSON in remainder', () => {
      const buffer = '{"content":"Hello"}{"incomplete":';
      const result = client.extractJsonChunks(buffer);

      expect(result.extracted).toHaveLength(1);
      expect(result.remainder).toBe('{"incomplete":');
    });

    test('should handle buffer with no JSON', () => {
      const buffer = 'plain text';
      const result = client.extractJsonChunks(buffer);

      expect(result.extracted).toHaveLength(0);
      expect(result.remainder).toBe('plain text');
    });
  });

  describe('parseN8nChunk', () => {
    test('should extract content from JSON chunk', () => {
      const chunk = '{"content":"Hello world"}';
      const result = client.parseN8nChunk(chunk);

      expect(result).toBe('Hello world');
    });

    test('should extract text from JSON chunk', () => {
      const chunk = '{"text":"Hello world"}';
      const result = client.parseN8nChunk(chunk);

      expect(result).toBe('Hello world');
    });

    test('should extract output from JSON chunk', () => {
      const chunk = '{"output":"Hello world"}';
      const result = client.parseN8nChunk(chunk);

      expect(result).toBe('Hello world');
    });

    test('should skip metadata chunks', () => {
      const chunk = '{"type":"metadata","data":"ignored"}';
      const result = client.parseN8nChunk(chunk);

      expect(result).toBeNull();
    });

    test('should skip begin/end/error chunks', () => {
      expect(client.parseN8nChunk('{"type":"begin"}')).toBeNull();
      expect(client.parseN8nChunk('{"type":"end"}')).toBeNull();
      expect(client.parseN8nChunk('{"type":"error"}')).toBeNull();
    });

    test('should handle plain text', () => {
      const result = client.parseN8nChunk('plain text');

      expect(result).toBe('plain text');
    });

    test('should return null for empty input', () => {
      expect(client.parseN8nChunk('')).toBeNull();
      expect(client.parseN8nChunk('   ')).toBeNull();
    });

    test('should return null for invalid JSON starting with brace', () => {
      const result = client.parseN8nChunk('{invalid json}');

      expect(result).toBeNull();
    });
  });
});
