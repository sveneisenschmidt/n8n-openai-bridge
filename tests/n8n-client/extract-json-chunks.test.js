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

  test('should handle braces inside string values (CSS content)', () => {
    const buffer = '{"content":"body { margin: 0; } div { color: red; }"}';
    const result = client.extractJsonChunks(buffer);

    expect(result.extracted).toHaveLength(1);
    expect(result.extracted[0]).toBe(buffer);
    expect(JSON.parse(result.extracted[0]).content).toBe('body { margin: 0; } div { color: red; }');
  });

  test('should handle artifact syntax with braces in string', () => {
    const buffer =
      '{"content":":::artifact{identifier=\\"test\\" type=\\"text/html\\"}\\n```html\\n<div></div>\\n```\\n:::"}';
    const result = client.extractJsonChunks(buffer);

    expect(result.extracted).toHaveLength(1);
    expect(result.extracted[0]).toBe(buffer);
    const parsed = JSON.parse(result.extracted[0]);
    expect(parsed.content).toContain(':::artifact{identifier="test"');
  });

  test('should handle escaped quotes inside strings', () => {
    const buffer = '{"content":"He said \\"hello { world }\\""}';
    const result = client.extractJsonChunks(buffer);

    expect(result.extracted).toHaveLength(1);
    expect(result.extracted[0]).toBe(buffer);
  });

  test('should handle unbalanced braces inside strings', () => {
    const buffer = '{"content":"Opening brace { only"}{"content":"Closing } only"}';
    const result = client.extractJsonChunks(buffer);

    expect(result.extracted).toHaveLength(2);
    expect(result.extracted[0]).toBe('{"content":"Opening brace { only"}');
    expect(result.extracted[1]).toBe('{"content":"Closing } only"}');
  });

  test('should handle complex HTML/CSS content in strings', () => {
    const cssContent = '<style>body { margin: 0; height: 100vh; } div { width: 8px; }</style>';
    const buffer = `{"content":"${cssContent}"}`;
    const result = client.extractJsonChunks(buffer);

    expect(result.extracted).toHaveLength(1);
    expect(result.extracted[0]).toBe(buffer);
    expect(JSON.parse(result.extracted[0]).content).toBe(cssContent);
  });
});
