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
    const payload = client.buildPayload(
      messages,
      'session-123',
      userContext,
      'req.body.session_id',
    );

    expect(payload.currentMessage).toBe(longMessage);
    expect(payload.currentMessage.length).toBe(10000);
  });

  test('should handle messages with special characters', () => {
    const messages = [{ role: 'user', content: 'Test with \n newlines \t tabs and "quotes"' }];

    const userContext = { userId: 'test-user' };
    const payload = client.buildPayload(
      messages,
      'session-123',
      userContext,
      'req.body.session_id',
    );

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

    const payload = client.buildPayload(
      messages,
      'session-123',
      userContext,
      'req.body.session_id',
    );

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

    const payload = client.buildPayload(
      messages,
      'session-123',
      userContext,
      'req.body.session_id',
    );

    expect(payload.userId).toBe('test-user');
    // undefined, null, and empty string should all be excluded
    expect(payload).not.toHaveProperty('userEmail');
    expect(payload).not.toHaveProperty('userName');
    expect(payload).not.toHaveProperty('userRole');
  });
});

describe('buildPayload - Message Consolidation', () => {
  let client;

  beforeEach(() => {
    jest.clearAllMocks();
    client = createTestClient();
  });

  test('should consolidate messages when session is generated and multiple messages exist', () => {
    const messages = [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there!' },
      { role: 'user', content: 'How are you?' },
    ];

    const userContext = { userId: 'test-user' };
    const payload = client.buildPayload(
      messages,
      'generated-uuid-123',
      userContext,
      'generated (new UUID)',
    );

    expect(payload.currentMessage).toBe(
      '<user>Hello</user><assistant>Hi there!</assistant><user>How are you?</user>',
    );
    expect(payload.chatInput).toBe(
      '<user>Hello</user><assistant>Hi there!</assistant><user>How are you?</user>',
    );
    // messages array should remain unchanged for backward compatibility
    expect(payload.messages).toHaveLength(3);
  });

  test('should not consolidate when session is provided (not generated)', () => {
    const messages = [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there!' },
      { role: 'user', content: 'How are you?' },
    ];

    const userContext = { userId: 'test-user' };
    const payload = client.buildPayload(
      messages,
      'user-session-123',
      userContext,
      'req.body.session_id',
    );

    // Should only contain the last message
    expect(payload.currentMessage).toBe('How are you?');
    expect(payload.chatInput).toBe('How are you?');
  });

  test('should not consolidate when session is generated but only one message exists', () => {
    const messages = [{ role: 'user', content: 'Hello' }];

    const userContext = { userId: 'test-user' };
    const payload = client.buildPayload(
      messages,
      'generated-uuid-123',
      userContext,
      'generated (new UUID)',
    );

    // Single message should be returned as-is (no wrapping)
    expect(payload.currentMessage).toBe('Hello');
    expect(payload.chatInput).toBe('Hello');
  });

  test('should exclude system messages from consolidation', () => {
    const messages = [
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there!' },
      { role: 'user', content: 'How are you?' },
    ];

    const userContext = { userId: 'test-user' };
    const payload = client.buildPayload(
      messages,
      'generated-uuid-123',
      userContext,
      'generated (new UUID)',
    );

    // System message should be extracted separately
    expect(payload.systemPrompt).toBe('You are a helpful assistant.');
    // Consolidation should only include non-system messages
    expect(payload.currentMessage).toBe(
      '<user>Hello</user><assistant>Hi there!</assistant><user>How are you?</user>',
    );
    // messages array should exclude system message
    expect(payload.messages).toHaveLength(3);
  });

  test('should handle consolidation with undefined sessionSource', () => {
    const messages = [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there!' },
    ];

    const userContext = { userId: 'test-user' };
    const payload = client.buildPayload(messages, 'session-123', userContext, undefined);

    // Should behave as if session was provided (no consolidation)
    expect(payload.currentMessage).toBe('Hi there!');
  });

  test('should handle consolidation with multimodal content', () => {
    const messages = [
      {
        role: 'user',
        content: [
          { type: 'text', text: 'What is this?' },
          { type: 'image_url', image_url: { url: 'data:image/png;base64,abc' } },
        ],
      },
      { role: 'assistant', content: 'It is an image.' },
      { role: 'user', content: 'Thanks!' },
    ];

    const userContext = { userId: 'test-user' };
    const payload = client.buildPayload(
      messages,
      'generated-uuid-123',
      userContext,
      'generated (new UUID)',
    );

    // Should extract text from multimodal and consolidate
    expect(payload.currentMessage).toBe(
      '<user>What is this?</user><assistant>It is an image.</assistant><user>Thanks!</user>',
    );
  });
});
