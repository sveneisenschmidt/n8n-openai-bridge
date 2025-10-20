const { extractSessionId } = require('../../../src/services/sessionService');

describe('SessionService', () => {
  const mockUuidGenerator = () => 'mock-uuid-12345';
  const sessionIdHeaders = ['X-Session-Id', 'X-Chat-Id'];

  describe('extractSessionId', () => {
    test('should extract from req.body.session_id first', () => {
      const req = {
        body: { session_id: 'body-session-123' },
        headers: { 'x-session-id': 'header-session-456' },
      };

      const result = extractSessionId(req, sessionIdHeaders, mockUuidGenerator);

      expect(result.sessionId).toBe('body-session-123');
      expect(result.sessionSource).toBe('req.body.session_id');
    });

    test('should extract from req.body.conversation_id as fallback', () => {
      const req = {
        body: { conversation_id: 'conversation-789' },
        headers: {},
      };

      const result = extractSessionId(req, sessionIdHeaders, mockUuidGenerator);

      expect(result.sessionId).toBe('conversation-789');
      expect(result.sessionSource).toBe('req.body.conversation_id');
    });

    test('should extract from req.body.chat_id as fallback', () => {
      const req = {
        body: { chat_id: 'chat-456' },
        headers: {},
      };

      const result = extractSessionId(req, sessionIdHeaders, mockUuidGenerator);

      expect(result.sessionId).toBe('chat-456');
      expect(result.sessionSource).toBe('req.body.chat_id');
    });

    test('should extract from X-Session-Id header when body is empty', () => {
      const req = {
        body: {},
        headers: { 'x-session-id': 'header-session-123' },
      };

      const result = extractSessionId(req, sessionIdHeaders, mockUuidGenerator);

      expect(result.sessionId).toBe('header-session-123');
      expect(result.sessionSource).toBe('headers[X-Session-Id]');
    });

    test('should extract from X-Chat-Id header as fallback', () => {
      const req = {
        body: {},
        headers: { 'x-chat-id': 'chat-header-456' },
      };

      const result = extractSessionId(req, sessionIdHeaders, mockUuidGenerator);

      expect(result.sessionId).toBe('chat-header-456');
      expect(result.sessionSource).toBe('headers[X-Chat-Id]');
    });

    test('should prioritize first header when multiple are present', () => {
      const req = {
        body: {},
        headers: {
          'x-session-id': 'session-first',
          'x-chat-id': 'chat-second',
        },
      };

      const result = extractSessionId(req, sessionIdHeaders, mockUuidGenerator);

      expect(result.sessionId).toBe('session-first');
      expect(result.sessionSource).toBe('headers[X-Session-Id]');
    });

    test('should generate UUID when no session info is provided', () => {
      const req = {
        body: {},
        headers: {},
      };

      const result = extractSessionId(req, sessionIdHeaders, mockUuidGenerator);

      expect(result.sessionId).toBe('mock-uuid-12345');
      expect(result.sessionSource).toBe('generated (new UUID)');
    });

    test('should handle missing body gracefully', () => {
      const req = {
        headers: {},
      };

      const result = extractSessionId(req, sessionIdHeaders, mockUuidGenerator);

      expect(result.sessionId).toBe('mock-uuid-12345');
    });

    test('should handle empty sessionIdHeaders array', () => {
      const req = {
        body: {},
        headers: { 'x-some-header': 'value' },
      };

      const result = extractSessionId(req, [], mockUuidGenerator);

      expect(result.sessionId).toBe('mock-uuid-12345');
    });

    test('should be case-insensitive for headers', () => {
      const req = {
        body: {},
        headers: { 'x-session-id': 'case-test' }, // Express normalizes to lowercase
      };

      const result = extractSessionId(req, sessionIdHeaders, mockUuidGenerator);

      expect(result.sessionId).toBe('case-test');
    });
  });
});
