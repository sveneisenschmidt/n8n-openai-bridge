/**
 * Integration Tests: N8nClient - Malformed Response Handling
 * Tests handling of empty, corrupted, and split JSON responses
 *
 * Copyright (c) 2025 Sven Eisenschmidt
 * Licensed under AGPL-3.0
 */

const axios = require('axios');
const { createTestClient } = require('../helpers/test-client');

// Mock console methods
global.console = {
  ...console,
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Mock axios
jest.mock('axios');

describe('N8nClient - Malformed Response Handling', () => {
  let client;

  beforeEach(() => {
    jest.clearAllMocks();
    client = createTestClient();
  });

  test('should handle empty stream', async () => {
    const mockStream = {
      async *[Symbol.asyncIterator]() {
        // Empty stream
      },
    };

    axios.post.mockResolvedValue({ data: mockStream });

    const userContext = { userId: 'test-user' };
    const result = await client.nonStreamingCompletion(
      'https://n8n.example.com/webhook/test',
      [{ role: 'user', content: 'Hello' }],
      'session-123',
      userContext,
    );

    expect(result).toBe('');
  });

  test('should handle stream with only metadata', async () => {
    const mockStream = {
      async *[Symbol.asyncIterator]() {
        yield Buffer.from('{"type":"begin"}');
        yield Buffer.from('{"type":"metadata","data":{}}');
        yield Buffer.from('{"type":"end"}');
      },
    };

    axios.post.mockResolvedValue({ data: mockStream });

    const userContext = { userId: 'test-user' };
    const result = await client.nonStreamingCompletion(
      'https://n8n.example.com/webhook/test',
      [{ role: 'user', content: 'Hello' }],
      'session-123',
      userContext,
    );

    expect(result).toBe('');
  });

  test('should handle corrupted JSON chunks', async () => {
    const mockStream = {
      async *[Symbol.asyncIterator]() {
        yield Buffer.from('{"content":"valid"}');
        yield Buffer.from('{corrupted json}');
        yield Buffer.from('{"content":"also valid"}');
      },
    };

    axios.post.mockResolvedValue({ data: mockStream });

    const userContext = { userId: 'test-user' };
    const result = await client.nonStreamingCompletion(
      'https://n8n.example.com/webhook/test',
      [{ role: 'user', content: 'Hello' }],
      'session-123',
      userContext,
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
      },
    };

    axios.post.mockResolvedValue({ data: mockStream });

    const userContext = { userId: 'test-user' };
    const result = await client.nonStreamingCompletion(
      'https://n8n.example.com/webhook/test',
      [{ role: 'user', content: 'Hello' }],
      'session-123',
      userContext,
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
      },
    };

    axios.post.mockResolvedValue({ data: mockStream });

    const userContext = { userId: 'test-user' };
    const result = await client.nonStreamingCompletion(
      'https://n8n.example.com/webhook/test',
      [{ role: 'user', content: 'Hello' }],
      'session-123',
      userContext,
    );

    expect(result.length).toBeGreaterThan(90000);
  });
});
