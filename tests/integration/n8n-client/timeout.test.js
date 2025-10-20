/**
 * Integration Tests: N8nClient - Timeout Handling
 * Tests timeout handling and long-running requests
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

describe('N8nClient - Timeout Handling', () => {
  let client;

  beforeEach(() => {
    jest.clearAllMocks();
    client = createTestClient();
  });

  test('should handle timeout errors', async () => {
    axios.post.mockRejectedValue({
      code: 'ECONNABORTED',
      message: 'timeout of 300000ms exceeded',
    });

    const userContext = { userId: 'test-user' };

    await expect(
      client.nonStreamingCompletion(
        'https://n8n.example.com/webhook/test',
        [{ role: 'user', content: 'Hello' }],
        'session-123',
        userContext,
      ),
    ).rejects.toMatchObject({
      code: 'ECONNABORTED',
    });
  });

  test('should timeout after 5 minutes by default', async () => {
    const mockStream = {
      async *[Symbol.asyncIterator]() {
        // Simulate long-running request
        await new Promise((resolve) => setTimeout(resolve, 100));
        yield Buffer.from('{"content":"test"}');
      },
    };

    axios.post.mockResolvedValue({ data: mockStream });

    const userContext = { userId: 'test-user' };
    await client.nonStreamingCompletion(
      'https://n8n.example.com/webhook/test',
      [{ role: 'user', content: 'Hello' }],
      'session-123',
      userContext,
    );

    // Verify timeout is configured
    expect(axios.post).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Object),
      expect.objectContaining({
        timeout: 300000, // 5 minutes
      }),
    );
  });
});
