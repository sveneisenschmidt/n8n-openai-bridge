/**
 * Integration Tests: N8nClient - Special Characters
 * Tests handling of unicode, escaped characters, and quotes
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

describe('N8nClient - Special Characters', () => {
  let client;

  beforeEach(() => {
    jest.clearAllMocks();
    client = createTestClient();
  });

  test('should handle unicode characters', async () => {
    const mockStream = {
      async *[Symbol.asyncIterator]() {
        yield Buffer.from('{"content":"Hello 世界 🌍"}');
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

    expect(result).toBe('Hello 世界 🌍');
  });

  test('should handle multibyte unicode split across chunks', async () => {
    const full = Buffer.from('{"content":"nächste"}', 'utf8');
    const umlautBytes = Buffer.from('ä', 'utf8'); // 2-byte sequence in UTF-8
    const umlautStartIdx = full.indexOf(umlautBytes);

    expect(umlautStartIdx).toBeGreaterThan(-1);

    // Split in the middle of the UTF-8 sequence for 'ä'
    const first = full.slice(0, umlautStartIdx + 1);
    const second = full.slice(umlautStartIdx + 1);

    const mockStream = {
      async *[Symbol.asyncIterator]() {
        yield first;
        yield second;
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

    expect(result).toBe('nächste');
  });

  test('should handle escaped characters', async () => {
    const mockStream = {
      async *[Symbol.asyncIterator]() {
        yield Buffer.from('{"content":"Line 1\\nLine 2\\tTabbed"}');
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

    expect(result).toContain('Line 1');
    expect(result).toContain('Line 2');
  });

  test('should handle nested quotes', async () => {
    const mockStream = {
      async *[Symbol.asyncIterator]() {
        yield Buffer.from('{"content":"She said \\"Hello\\" to me"}');
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

    expect(result).toContain('Hello');
  });
});
