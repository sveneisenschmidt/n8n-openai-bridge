/**
 * Integration Tests: buildPayload - Edge Cases
 * Tests payload building with edge cases and special inputs
 *
 * Copyright (c) 2025 Sven Eisenschmidt
 * Licensed under AGPL-3.0
 */

const { createTestClient } = require('../helpers/test-client');

// Mock console methods
global.console = {
  ...console,
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

describe('buildPayload - Edge Cases', () => {
  let client;

  beforeEach(() => {
    jest.clearAllMocks();
    client = createTestClient();
  });

  test('should handle very long messages', () => {
    const longMessage = 'A'.repeat(10000);
    const messages = [{ role: 'user', content: longMessage }];

    const userContext = { userId: 'test-user' };
    const payload = client.buildPayload(messages, 'session-123', userContext);

    expect(payload.currentMessage).toBe(longMessage);
    expect(payload.currentMessage.length).toBe(10000);
  });

  test('should handle messages with special characters', () => {
    const messages = [{ role: 'user', content: 'Test with \n newlines \t tabs and "quotes"' }];

    const userContext = { userId: 'test-user' };
    const payload = client.buildPayload(messages, 'session-123', userContext);

    expect(payload.currentMessage).toContain('\n');
    expect(payload.currentMessage).toContain('\t');
    expect(payload.currentMessage).toContain('"');
  });

  test('should handle empty user context fields', () => {
    const messages = [{ role: 'user', content: 'Hello' }];

    const userContext = {
      userId: '',
      userEmail: '',
      userName: '',
      userRole: '',
    };

    const payload = client.buildPayload(messages, 'session-123', userContext);

    expect(payload.userId).toBe('');
    expect(payload).not.toHaveProperty('userEmail');
    expect(payload).not.toHaveProperty('userName');
    expect(payload).not.toHaveProperty('userRole');
  });

  test('should handle undefined vs null user fields differently', () => {
    const messages = [{ role: 'user', content: 'Hello' }];

    const userContext = {
      userId: 'test-user',
      userEmail: undefined,
      userName: null,
      userRole: '',
    };

    const payload = client.buildPayload(messages, 'session-123', userContext);

    expect(payload.userId).toBe('test-user');
    // undefined, null, and empty string should all be excluded
    expect(payload).not.toHaveProperty('userEmail');
    expect(payload).not.toHaveProperty('userName');
    expect(payload).not.toHaveProperty('userRole');
  });
});
