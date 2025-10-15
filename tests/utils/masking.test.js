const { maskSensitiveHeaders, maskSensitiveBody } = require('../../src/utils/masking');

describe('Masking Utils', () => {
  describe('maskSensitiveHeaders', () => {
    test('should mask Bearer token in Authorization header', () => {
      const headers = {
        authorization: 'Bearer sk-1234567890abcdefghijklmnopqrstuvwxyz',
        'content-type': 'application/json',
      };

      const masked = maskSensitiveHeaders(headers);

      expect(masked.authorization).toBe('Bearer sk-12345...wxyz');
      expect(masked['content-type']).toBe('application/json');
    });

    test('should handle short tokens (< 12 chars) without masking', () => {
      const headers = {
        authorization: 'Bearer short',
      };

      const masked = maskSensitiveHeaders(headers);

      expect(masked.authorization).toBe('Bearer short');
    });

    test('should handle malformed Authorization header', () => {
      const headers = {
        authorization: 'InvalidFormat',
      };

      const masked = maskSensitiveHeaders(headers);

      expect(masked.authorization).toBe('InvalidFormat');
    });

    test('should not modify headers without authorization', () => {
      const headers = {
        'content-type': 'application/json',
        'user-agent': 'test-client',
      };

      const masked = maskSensitiveHeaders(headers);

      expect(masked).toEqual(headers);
    });

    test('should not mutate original headers object', () => {
      const headers = {
        authorization: 'Bearer sk-1234567890abcdefghijklmnopqrstuvwxyz',
      };

      const originalAuth = headers.authorization;
      maskSensitiveHeaders(headers);

      expect(headers.authorization).toBe(originalAuth);
    });

    test('should handle empty headers object', () => {
      const masked = maskSensitiveHeaders({});
      expect(masked).toEqual({});
    });
  });

  describe('maskSensitiveBody', () => {
    test('should mask api_key in body', () => {
      const body = {
        api_key: 'sk-1234567890abcdefghijklmnopqrstuvwxyz',
        model: 'test-model',
      };

      const masked = maskSensitiveBody(body);

      expect(masked.api_key).toBe('sk-12345...wxyz');
      expect(masked.model).toBe('test-model');
    });

    test('should handle short api_key (< 12 chars) without masking', () => {
      const body = {
        api_key: 'short',
      };

      const masked = maskSensitiveBody(body);

      expect(masked.api_key).toBe('short');
    });

    test('should handle body without api_key', () => {
      const body = {
        model: 'test-model',
        messages: [],
      };

      const masked = maskSensitiveBody(body);

      expect(masked).toEqual(body);
    });

    test('should handle null body', () => {
      const masked = maskSensitiveBody(null);
      expect(masked).toBeNull();
    });

    test('should handle undefined body', () => {
      const masked = maskSensitiveBody(undefined);
      expect(masked).toBeUndefined();
    });

    test('should handle non-object body', () => {
      expect(maskSensitiveBody('string')).toBe('string');
      expect(maskSensitiveBody(123)).toBe(123);
      expect(maskSensitiveBody(true)).toBe(true);
    });

    test('should not mutate original body object', () => {
      const body = {
        api_key: 'sk-1234567890abcdefghijklmnopqrstuvwxyz',
      };

      const originalKey = body.api_key;
      maskSensitiveBody(body);

      expect(body.api_key).toBe(originalKey);
    });

    test('should handle empty body object', () => {
      const masked = maskSensitiveBody({});
      expect(masked).toEqual({});
    });

    test('should handle non-string api_key', () => {
      const body = {
        api_key: 12345,
      };

      const masked = maskSensitiveBody(body);

      expect(masked.api_key).toBe(12345);
    });
  });
});