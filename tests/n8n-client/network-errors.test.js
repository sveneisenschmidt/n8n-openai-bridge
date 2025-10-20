/**
 * Integration Tests: N8nClient - Network Errors
 * Tests network error handling (connection refused, DNS, SSL)
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

describe('N8nClient - Network Errors', () => {
  let client;

  beforeEach(() => {
    jest.clearAllMocks();
    client = createTestClient();
  });

  test('should handle connection refused', async () => {
    axios.post.mockRejectedValue({
      code: 'ECONNREFUSED',
      message: 'connect ECONNREFUSED 127.0.0.1:5678',
    });

    const userContext = { userId: 'test-user' };

    await expect(
      client
        .streamCompletion(
          'https://n8n.example.com/webhook/test',
          [{ role: 'user', content: 'Hello' }],
          'session-123',
          userContext,
        )
        .next(),
    ).rejects.toMatchObject({
      code: 'ECONNREFUSED',
    });
  });

  test('should handle DNS resolution errors', async () => {
    axios.post.mockRejectedValue({
      code: 'ENOTFOUND',
      message: 'getaddrinfo ENOTFOUND invalid-domain.example.com',
    });

    const userContext = { userId: 'test-user' };

    await expect(
      client.nonStreamingCompletion(
        'https://invalid-domain.example.com/webhook/test',
        [{ role: 'user', content: 'Hello' }],
        'session-123',
        userContext,
      ),
    ).rejects.toMatchObject({
      code: 'ENOTFOUND',
    });
  });

  test('should handle SSL/TLS errors', async () => {
    axios.post.mockRejectedValue({
      code: 'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
      message: 'unable to verify the first certificate',
    });

    const userContext = { userId: 'test-user' };

    await expect(
      client.nonStreamingCompletion(
        'https://self-signed.example.com/webhook/test',
        [{ role: 'user', content: 'Hello' }],
        'session-123',
        userContext,
      ),
    ).rejects.toMatchObject({
      code: 'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
    });
  });
});
