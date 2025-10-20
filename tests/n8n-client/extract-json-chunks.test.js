/**
 * Integration Tests: extractJsonChunks - Edge Cases
 * Tests JSON extraction with nested objects, arrays, and mixed content
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

describe('extractJsonChunks - Edge Cases', () => {
  let client;

  beforeEach(() => {
    jest.clearAllMocks();
    client = createTestClient();
  });

  test('should handle deeply nested objects', () => {
    const buffer = '{"a":{"b":{"c":{"d":"value"}}}}';
    const result = client.extractJsonChunks(buffer);

    expect(result.extracted).toHaveLength(1);
    expect(result.extracted[0]).toBe(buffer);
  });

  test('should handle arrays in JSON', () => {
    const buffer = '{"items":[1,2,3,{"nested":"value"}]}';
    const result = client.extractJsonChunks(buffer);

    expect(result.extracted).toHaveLength(1);
    expect(result.extracted[0]).toBe(buffer);
  });

  test('should handle empty objects', () => {
    const buffer = '{}{}{}';
    const result = client.extractJsonChunks(buffer);

    expect(result.extracted).toHaveLength(3);
    expect(result.extracted[0]).toBe('{}');
  });

  test('should handle mixed valid and invalid JSON', () => {
    const buffer = 'prefix{"valid":true}suffix{"also":"valid"}';
    const result = client.extractJsonChunks(buffer);

    expect(result.extracted).toHaveLength(2);
    expect(result.extracted[0]).toBe('{"valid":true}');
    expect(result.extracted[1]).toBe('{"also":"valid"}');
  });
});
