const { validateChatCompletionRequest } = require('../../src/services/validationService');

describe('ValidationService', () => {
  describe('validateChatCompletionRequest', () => {
    test('should validate valid request', () => {
      const body = {
        model: 'test-model',
        messages: [{ role: 'user', content: 'Hello' }],
      };

      const result = validateChatCompletionRequest(body);

      expect(result.valid).toBe(true);
      expect(result.error).toBeNull();
    });

    test('should reject request without model', () => {
      const body = {
        messages: [{ role: 'user', content: 'Hello' }],
      };

      const result = validateChatCompletionRequest(body);

      expect(result.valid).toBe(false);
      expect(result.error).toEqual({
        message: 'Missing required fields: model, messages',
        type: 'invalid_request_error',
      });
    });

    test('should reject request without messages', () => {
      const body = {
        model: 'test-model',
      };

      const result = validateChatCompletionRequest(body);

      expect(result.valid).toBe(false);
      expect(result.error).toEqual({
        message: 'Missing required fields: model, messages',
        type: 'invalid_request_error',
      });
    });

    test('should reject request with empty messages array', () => {
      const body = {
        model: 'test-model',
        messages: [],
      };

      const result = validateChatCompletionRequest(body);

      expect(result.valid).toBe(false);
      expect(result.error).toEqual({
        message: 'messages must be a non-empty array',
        type: 'invalid_request_error',
      });
    });

    test('should reject request with non-array messages', () => {
      const body = {
        model: 'test-model',
        messages: 'not an array',
      };

      const result = validateChatCompletionRequest(body);

      expect(result.valid).toBe(false);
      expect(result.error.message).toContain('non-empty array');
    });

    test('should reject request with null messages', () => {
      const body = {
        model: 'test-model',
        messages: null,
      };

      const result = validateChatCompletionRequest(body);

      expect(result.valid).toBe(false);
    });

    test('should reject completely empty request', () => {
      const body = {};

      const result = validateChatCompletionRequest(body);

      expect(result.valid).toBe(false);
      expect(result.error.type).toBe('invalid_request_error');
    });

    test('should accept request with multiple messages', () => {
      const body = {
        model: 'test-model',
        messages: [
          { role: 'system', content: 'System prompt' },
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi there!' },
        ],
      };

      const result = validateChatCompletionRequest(body);

      expect(result.valid).toBe(true);
    });

    test('should accept request with additional optional fields', () => {
      const body = {
        model: 'test-model',
        messages: [{ role: 'user', content: 'Hello' }],
        stream: false,
        temperature: 0.7,
        max_tokens: 100,
      };

      const result = validateChatCompletionRequest(body);

      expect(result.valid).toBe(true);
    });
  });
});
