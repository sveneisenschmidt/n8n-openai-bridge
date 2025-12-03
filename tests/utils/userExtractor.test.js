const { extractUserContext, extractFromHeaders } = require('../../src/utils/userExtractor');

describe('UserService', () => {
  const mockConfig = {
    userIdHeaders: ['X-User-Id', 'X-OpenWebUI-User-Id'],
    userEmailHeaders: ['X-User-Email', 'X-OpenWebUI-User-Email'],
    userNameHeaders: ['X-User-Name', 'X-OpenWebUI-User-Name'],
    userRoleHeaders: ['X-User-Role', 'X-OpenWebUI-User-Role'],
  };

  describe('extractFromHeaders', () => {
    test('should extract value from first matching header', () => {
      const headers = {
        'x-user-id': 'user-123',
        'x-openwebui-user-id': 'user-456',
      };

      const result = extractFromHeaders(headers, mockConfig.userIdHeaders);

      expect(result).toBe('user-123');
    });

    test('should return null when no headers match', () => {
      const headers = {
        'x-other-header': 'value',
      };

      const result = extractFromHeaders(headers, mockConfig.userIdHeaders);

      expect(result).toBeNull();
    });

    test('should be case-insensitive', () => {
      const headers = {
        'x-user-id': 'user-lowercase', // Express normalizes to lowercase
      };

      const result = extractFromHeaders(headers, mockConfig.userIdHeaders);

      expect(result).toBe('user-lowercase');
    });

    test('should return null for empty header array', () => {
      const headers = {
        'x-user-id': 'user-123',
      };

      const result = extractFromHeaders(headers, []);

      expect(result).toBeNull();
    });
  });

  describe('extractUserContext', () => {
    test('should extract all user fields from headers', () => {
      const req = {
        headers: {
          'x-user-id': 'user-123',
          'x-user-email': 'user@example.com',
          'x-user-name': 'John Doe',
          'x-user-role': 'admin',
        },
        body: {},
      };

      const result = extractUserContext(req, mockConfig);

      expect(result).toEqual({
        userId: 'user-123',
        userEmail: 'user@example.com',
        userName: 'John Doe',
        userRole: 'admin',
      });
    });

    test('should extract from body when headers are missing', () => {
      const req = {
        headers: {},
        body: {
          user_id: 'body-user-456',
          user_email: 'body@example.com',
          user_name: 'Jane Doe',
          user_role: 'user',
        },
      };

      const result = extractUserContext(req, mockConfig);

      expect(result).toEqual({
        userId: 'body-user-456',
        userEmail: 'body@example.com',
        userName: 'Jane Doe',
        userRole: 'user',
      });
    });

    test('should use camelCase body fields as fallback', () => {
      const req = {
        headers: {},
        body: {
          userId: 'camel-user-789',
          userEmail: 'camel@example.com',
          userName: 'Camel Case',
          userRole: 'moderator',
        },
      };

      const result = extractUserContext(req, mockConfig);

      expect(result).toEqual({
        userId: 'camel-user-789',
        userEmail: 'camel@example.com',
        userName: 'Camel Case',
        userRole: 'moderator',
      });
    });

    test('should use "user" field from body for userId', () => {
      const req = {
        headers: {},
        body: {
          user: 'simple-user-field',
        },
      };

      const result = extractUserContext(req, mockConfig);

      expect(result.userId).toBe('simple-user-field');
    });

    test('should default userId to "anonymous" when not provided', () => {
      const req = {
        headers: {},
        body: {},
      };

      const result = extractUserContext(req, mockConfig);

      expect(result.userId).toBe('anonymous');
      expect(result.userEmail).toBeNull();
      expect(result.userName).toBeNull();
      expect(result.userRole).toBeNull();
    });

    test('should prioritize headers over body fields', () => {
      const req = {
        headers: {
          'x-user-id': 'header-user',
        },
        body: {
          user_id: 'body-user',
        },
      };

      const result = extractUserContext(req, mockConfig);

      expect(result.userId).toBe('header-user');
    });

    test('should use fallback headers (OpenWebUI)', () => {
      const req = {
        headers: {
          'x-openwebui-user-id': 'openwebui-user-123',
          'x-openwebui-user-email': 'openwebui@example.com',
        },
        body: {},
      };

      const result = extractUserContext(req, mockConfig);

      expect(result.userId).toBe('openwebui-user-123');
      expect(result.userEmail).toBe('openwebui@example.com');
    });

    test('should handle partially filled user context', () => {
      const req = {
        headers: {
          'x-user-id': 'user-partial',
          'x-user-email': 'partial@example.com',
        },
        body: {},
      };

      const result = extractUserContext(req, mockConfig);

      expect(result.userId).toBe('user-partial');
      expect(result.userEmail).toBe('partial@example.com');
      expect(result.userName).toBeNull();
      expect(result.userRole).toBeNull();
    });

    test('should handle missing body gracefully', () => {
      const req = {
        headers: {},
      };

      const result = extractUserContext(req, mockConfig);

      expect(result.userId).toBe('anonymous');
    });

    test('should handle null/undefined body fields', () => {
      const req = {
        headers: {},
        body: {
          user_id: null,
          user_email: undefined,
          user_name: '',
          user_role: null,
        },
      };

      const result = extractUserContext(req, mockConfig);

      expect(result.userId).toBe('anonymous');
      expect(result.userEmail).toBeNull();
      // Empty string is falsy, so fallback to null
      expect(result.userName).toBeNull();
      expect(result.userRole).toBeNull();
    });
  });
});
