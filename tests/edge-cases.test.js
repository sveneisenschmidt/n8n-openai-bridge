const axios = require('axios');
const N8nClient = require('../src/n8nClient');

// Mock console methods
global.console = {
  ...console,
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Mock axios
jest.mock('axios');

describe('Edge Cases and Error Handling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('N8nClient - Timeout Handling', () => {
    test('should handle timeout errors', async () => {
      axios.post.mockRejectedValue({
        code: 'ECONNABORTED',
        message: 'timeout of 300000ms exceeded'
      });

      const userContext = { userId: 'test-user' };

      await expect(
        N8nClient.nonStreamingCompletion(
          'https://n8n.example.com/webhook/test',
          [{ role: 'user', content: 'Hello' }],
          'session-123',
          userContext
        )
      ).rejects.toMatchObject({
        code: 'ECONNABORTED'
      });
    });

    test('should timeout after 5 minutes by default', async () => {
      const mockStream = {
        async *[Symbol.asyncIterator]() {
          // Simulate long-running request
          await new Promise(resolve => setTimeout(resolve, 100));
          yield Buffer.from('{"content":"test"}');
        }
      };

      axios.post.mockResolvedValue({ data: mockStream });

      const userContext = { userId: 'test-user' };
      const result = await N8nClient.nonStreamingCompletion(
        'https://n8n.example.com/webhook/test',
        [{ role: 'user', content: 'Hello' }],
        'session-123',
        userContext
      );

      // Verify timeout is configured
      expect(axios.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        expect.objectContaining({
          timeout: 300000 // 5 minutes
        })
      );
    });
  });

  describe('N8nClient - Network Errors', () => {
    test('should handle connection refused', async () => {
      axios.post.mockRejectedValue({
        code: 'ECONNREFUSED',
        message: 'connect ECONNREFUSED 127.0.0.1:5678'
      });

      const userContext = { userId: 'test-user' };

      await expect(
        N8nClient.streamCompletion(
          'https://n8n.example.com/webhook/test',
          [{ role: 'user', content: 'Hello' }],
          'session-123',
          userContext
        ).next()
      ).rejects.toMatchObject({
        code: 'ECONNREFUSED'
      });
    });

    test('should handle DNS resolution errors', async () => {
      axios.post.mockRejectedValue({
        code: 'ENOTFOUND',
        message: 'getaddrinfo ENOTFOUND invalid-domain.example.com'
      });

      const userContext = { userId: 'test-user' };

      await expect(
        N8nClient.nonStreamingCompletion(
          'https://invalid-domain.example.com/webhook/test',
          [{ role: 'user', content: 'Hello' }],
          'session-123',
          userContext
        )
      ).rejects.toMatchObject({
        code: 'ENOTFOUND'
      });
    });

    test('should handle SSL/TLS errors', async () => {
      axios.post.mockRejectedValue({
        code: 'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
        message: 'unable to verify the first certificate'
      });

      const userContext = { userId: 'test-user' };

      await expect(
        N8nClient.nonStreamingCompletion(
          'https://self-signed.example.com/webhook/test',
          [{ role: 'user', content: 'Hello' }],
          'session-123',
          userContext
        )
      ).rejects.toMatchObject({
        code: 'UNABLE_TO_VERIFY_LEAF_SIGNATURE'
      });
    });
  });

  describe('N8nClient - Malformed Response Handling', () => {
    test('should handle empty stream', async () => {
      const mockStream = {
        async *[Symbol.asyncIterator]() {
          // Empty stream
        }
      };

      axios.post.mockResolvedValue({ data: mockStream });

      const userContext = { userId: 'test-user' };
      const result = await N8nClient.nonStreamingCompletion(
        'https://n8n.example.com/webhook/test',
        [{ role: 'user', content: 'Hello' }],
        'session-123',
        userContext
      );

      expect(result).toBe('');
    });

    test('should handle stream with only metadata', async () => {
      const mockStream = {
        async *[Symbol.asyncIterator]() {
          yield Buffer.from('{"type":"begin"}');
          yield Buffer.from('{"type":"metadata","data":{}}');
          yield Buffer.from('{"type":"end"}');
        }
      };

      axios.post.mockResolvedValue({ data: mockStream });

      const userContext = { userId: 'test-user' };
      const result = await N8nClient.nonStreamingCompletion(
        'https://n8n.example.com/webhook/test',
        [{ role: 'user', content: 'Hello' }],
        'session-123',
        userContext
      );

      expect(result).toBe('');
    });

    test('should handle corrupted JSON chunks', async () => {
      const mockStream = {
        async *[Symbol.asyncIterator]() {
          yield Buffer.from('{"content":"valid"}');
          yield Buffer.from('{corrupted json}');
          yield Buffer.from('{"content":"also valid"}');
        }
      };

      axios.post.mockResolvedValue({ data: mockStream });

      const userContext = { userId: 'test-user' };
      const result = await N8nClient.nonStreamingCompletion(
        'https://n8n.example.com/webhook/test',
        [{ role: 'user', content: 'Hello' }],
        'session-123',
        userContext
      );

      // Should only collect valid chunks
      expect(result).toBe('validalso valid');
    });

    test('should handle split JSON across multiple chunks', async () => {
      const mockStream = {
        async *[Symbol.asyncIterator]() {
          yield Buffer.from('{"cont');
          yield Buffer.from('ent":"Hello ');
          yield Buffer.from('World"}');
        }
      };

      axios.post.mockResolvedValue({ data: mockStream });

      const userContext = { userId: 'test-user' };
      const result = await N8nClient.nonStreamingCompletion(
        'https://n8n.example.com/webhook/test',
        [{ role: 'user', content: 'Hello' }],
        'session-123',
        userContext
      );

      expect(result).toBe('Hello World');
    });

    test('should handle very large responses', async () => {
      const largeContent = 'A'.repeat(100000); // 100KB
      const mockStream = {
        async *[Symbol.asyncIterator]() {
          // Split into multiple chunks
          const chunkSize = 1000;
          for (let i = 0; i < largeContent.length; i += chunkSize) {
            const chunk = largeContent.substring(i, i + chunkSize);
            yield Buffer.from(`{"content":"${chunk}"}`);
          }
        }
      };

      axios.post.mockResolvedValue({ data: mockStream });

      const userContext = { userId: 'test-user' };
      const result = await N8nClient.nonStreamingCompletion(
        'https://n8n.example.com/webhook/test',
        [{ role: 'user', content: 'Hello' }],
        'session-123',
        userContext
      );

      expect(result.length).toBeGreaterThan(90000);
    });
  });

  describe('N8nClient - Special Characters', () => {
    test('should handle unicode characters', async () => {
      const mockStream = {
        async *[Symbol.asyncIterator]() {
          yield Buffer.from('{"content":"Hello 世界 🌍"}');
        }
      };

      axios.post.mockResolvedValue({ data: mockStream });

      const userContext = { userId: 'test-user' };
      const result = await N8nClient.nonStreamingCompletion(
        'https://n8n.example.com/webhook/test',
        [{ role: 'user', content: 'Hello' }],
        'session-123',
        userContext
      );

      expect(result).toBe('Hello 世界 🌍');
    });

    test('should handle escaped characters', async () => {
      const mockStream = {
        async *[Symbol.asyncIterator]() {
          yield Buffer.from('{"content":"Line 1\\nLine 2\\tTabbed"}');
        }
      };

      axios.post.mockResolvedValue({ data: mockStream });

      const userContext = { userId: 'test-user' };
      const result = await N8nClient.nonStreamingCompletion(
        'https://n8n.example.com/webhook/test',
        [{ role: 'user', content: 'Hello' }],
        'session-123',
        userContext
      );

      expect(result).toContain('Line 1');
      expect(result).toContain('Line 2');
    });

    test('should handle nested quotes', async () => {
      const mockStream = {
        async *[Symbol.asyncIterator]() {
          yield Buffer.from('{"content":"She said \\"Hello\\" to me"}');
        }
      };

      axios.post.mockResolvedValue({ data: mockStream });

      const userContext = { userId: 'test-user' };
      const result = await N8nClient.nonStreamingCompletion(
        'https://n8n.example.com/webhook/test',
        [{ role: 'user', content: 'Hello' }],
        'session-123',
        userContext
      );

      expect(result).toContain('Hello');
    });
  });

  describe('N8nClient - HTTP Error Responses', () => {
    test('should handle 401 Unauthorized', async () => {
      axios.post.mockRejectedValue({
        response: {
          status: 401,
          data: { error: 'Unauthorized' }
        }
      });

      const userContext = { userId: 'test-user' };

      await expect(
        N8nClient.nonStreamingCompletion(
          'https://n8n.example.com/webhook/test',
          [{ role: 'user', content: 'Hello' }],
          'session-123',
          userContext
        )
      ).rejects.toMatchObject({
        response: {
          status: 401
        }
      });
    });

    test('should handle 500 Internal Server Error', async () => {
      axios.post.mockRejectedValue({
        response: {
          status: 500,
          data: { error: 'Internal Server Error' }
        }
      });

      const userContext = { userId: 'test-user' };

      await expect(
        N8nClient.nonStreamingCompletion(
          'https://n8n.example.com/webhook/test',
          [{ role: 'user', content: 'Hello' }],
          'session-123',
          userContext
        )
      ).rejects.toMatchObject({
        response: {
          status: 500
        }
      });
    });

    test('should handle 503 Service Unavailable', async () => {
      axios.post.mockRejectedValue({
        response: {
          status: 503,
          data: { error: 'Service Unavailable' }
        }
      });

      const userContext = { userId: 'test-user' };

      await expect(
        N8nClient.nonStreamingCompletion(
          'https://n8n.example.com/webhook/test',
          [{ role: 'user', content: 'Hello' }],
          'session-123',
          userContext
        )
      ).rejects.toMatchObject({
        response: {
          status: 503
        }
      });
    });
  });

  describe('extractJsonChunks - Edge Cases', () => {
    test('should handle deeply nested objects', () => {
      const buffer = '{"a":{"b":{"c":{"d":"value"}}}}';
      const result = N8nClient.extractJsonChunks(buffer);

      expect(result.extracted).toHaveLength(1);
      expect(result.extracted[0]).toBe(buffer);
    });

    test('should handle arrays in JSON', () => {
      const buffer = '{"items":[1,2,3,{"nested":"value"}]}';
      const result = N8nClient.extractJsonChunks(buffer);

      expect(result.extracted).toHaveLength(1);
      expect(result.extracted[0]).toBe(buffer);
    });

    test('should handle empty objects', () => {
      const buffer = '{}{}{}';
      const result = N8nClient.extractJsonChunks(buffer);

      expect(result.extracted).toHaveLength(3);
      expect(result.extracted[0]).toBe('{}');
    });

    test('should handle mixed valid and invalid JSON', () => {
      const buffer = 'prefix{"valid":true}suffix{"also":"valid"}';
      const result = N8nClient.extractJsonChunks(buffer);

      expect(result.extracted).toHaveLength(2);
      expect(result.extracted[0]).toBe('{"valid":true}');
      expect(result.extracted[1]).toBe('{"also":"valid"}');
    });
  });

  describe('buildPayload - Edge Cases', () => {
    test('should handle very long messages', () => {
      const longMessage = 'A'.repeat(10000);
      const messages = [
        { role: 'user', content: longMessage }
      ];

      const userContext = { userId: 'test-user' };
      const payload = N8nClient.buildPayload(messages, 'session-123', userContext);

      expect(payload.currentMessage).toBe(longMessage);
      expect(payload.currentMessage.length).toBe(10000);
    });

    test('should handle messages with special characters', () => {
      const messages = [
        { role: 'user', content: 'Test with \n newlines \t tabs and "quotes"' }
      ];

      const userContext = { userId: 'test-user' };
      const payload = N8nClient.buildPayload(messages, 'session-123', userContext);

      expect(payload.currentMessage).toContain('\n');
      expect(payload.currentMessage).toContain('\t');
      expect(payload.currentMessage).toContain('"');
    });

    test('should handle empty user context fields', () => {
      const messages = [
        { role: 'user', content: 'Hello' }
      ];

      const userContext = {
        userId: '',
        userEmail: '',
        userName: '',
        userRole: ''
      };

      const payload = N8nClient.buildPayload(messages, 'session-123', userContext);

      expect(payload.userId).toBe('');
      expect(payload).not.toHaveProperty('userEmail');
      expect(payload).not.toHaveProperty('userName');
      expect(payload).not.toHaveProperty('userRole');
    });

    test('should handle undefined vs null user fields differently', () => {
      const messages = [
        { role: 'user', content: 'Hello' }
      ];

      const userContext = {
        userId: 'test-user',
        userEmail: undefined,
        userName: null,
        userRole: ''
      };

      const payload = N8nClient.buildPayload(messages, 'session-123', userContext);

      expect(payload.userId).toBe('test-user');
      // undefined, null, and empty string should all be excluded
      expect(payload).not.toHaveProperty('userEmail');
      expect(payload).not.toHaveProperty('userName');
      expect(payload).not.toHaveProperty('userRole');
    });
  });
});