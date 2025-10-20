/**
 * Integration Tests: N8nClient - HTTP Error Responses
 * Tests handling of HTTP error status codes
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

describe('N8nClient - HTTP Error Responses', () => {
  let client;

  beforeEach(() => {
    jest.clearAllMocks();
    client = createTestClient();
  });

  test('should handle 401 Unauthorized', async () => {
    axios.post.mockRejectedValue({
      response: {
        status: 401,
        data: { error: 'Unauthorized' },
      },
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
      response: {
        status: 401,
      },
    });
  });

  test('should handle 500 Internal Server Error', async () => {
    axios.post.mockRejectedValue({
      response: {
        status: 500,
        data: { error: 'Internal Server Error' },
      },
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
      response: {
        status: 500,
      },
    });
  });

  test('should handle 503 Service Unavailable', async () => {
    axios.post.mockRejectedValue({
      response: {
        status: 503,
        data: { error: 'Service Unavailable' },
      },
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
      response: {
        status: 503,
      },
    });
  });
});
