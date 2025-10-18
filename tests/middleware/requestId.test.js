/*
 * n8n OpenAI Bridge
 * Copyright (C) 2025 Sven Eisenschmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

const requestId = require('../../src/middleware/requestId');

// Mock uuid
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-uuid-1234'),
}));

describe('requestId middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      headers: {},
      method: 'GET',
      path: '/test',
      app: {
        locals: {
          config: {
            logRequests: false,
          },
        },
      },
    };
    res = {
      setHeader: jest.fn(),
    };
    next = jest.fn();

    // Clear console mocks
    jest.clearAllMocks();
  });

  describe('request ID generation', () => {
    it('should generate a new request ID when none exists', () => {
      const middleware = requestId();

      middleware(req, res, next);

      expect(req.id).toBe('req-mock-uuid-1234');
      expect(res.setHeader).toHaveBeenCalledWith('X-Request-ID', 'req-mock-uuid-1234');
      expect(next).toHaveBeenCalled();
    });

    it('should use existing x-request-id header if present', () => {
      req.headers['x-request-id'] = 'existing-request-id';

      const middleware = requestId();
      middleware(req, res, next);

      expect(req.id).toBe('existing-request-id');
      expect(res.setHeader).toHaveBeenCalledWith('X-Request-ID', 'existing-request-id');
      expect(next).toHaveBeenCalled();
    });

    it('should use existing x-correlation-id header if present', () => {
      req.headers['x-correlation-id'] = 'correlation-123';

      const middleware = requestId();
      middleware(req, res, next);

      expect(req.id).toBe('correlation-123');
      expect(res.setHeader).toHaveBeenCalledWith('X-Request-ID', 'correlation-123');
      expect(next).toHaveBeenCalled();
    });

    it('should prefer x-request-id over x-correlation-id', () => {
      req.headers['x-request-id'] = 'request-id-priority';
      req.headers['x-correlation-id'] = 'correlation-ignored';

      const middleware = requestId();
      middleware(req, res, next);

      expect(req.id).toBe('request-id-priority');
      expect(res.setHeader).toHaveBeenCalledWith('X-Request-ID', 'request-id-priority');
      expect(next).toHaveBeenCalled();
    });
  });

  describe('logging', () => {
    it('should log request when logRequests is true', () => {
      req.app.locals.config.logRequests = true;
      req.method = 'POST';
      req.path = '/v1/chat/completions';

      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      const middleware = requestId();
      middleware(req, res, next);

      expect(consoleLogSpy).toHaveBeenCalledWith('[req-mock-uuid-1234] POST /v1/chat/completions');
      expect(next).toHaveBeenCalled();

      consoleLogSpy.mockRestore();
    });

    it('should not log request when logRequests is false', () => {
      req.app.locals.config.logRequests = false;

      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      const middleware = requestId();
      middleware(req, res, next);

      expect(consoleLogSpy).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalled();

      consoleLogSpy.mockRestore();
    });

    it('should not log when config is not available', () => {
      req.app.locals.config = undefined;

      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      const middleware = requestId();
      middleware(req, res, next);

      expect(consoleLogSpy).not.toHaveBeenCalled();
      expect(req.id).toBe('req-mock-uuid-1234');
      expect(next).toHaveBeenCalled();

      consoleLogSpy.mockRestore();
    });

    it('should handle missing app.locals gracefully', () => {
      req.app = {};

      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      const middleware = requestId();
      middleware(req, res, next);

      expect(consoleLogSpy).not.toHaveBeenCalled();
      expect(req.id).toBe('req-mock-uuid-1234');
      expect(res.setHeader).toHaveBeenCalledWith('X-Request-ID', 'req-mock-uuid-1234');
      expect(next).toHaveBeenCalled();

      consoleLogSpy.mockRestore();
    });
  });

  describe('edge cases', () => {
    it('should handle headers with different casing', () => {
      req.headers['X-Request-ID'] = 'uppercase-request-id';

      const middleware = requestId();
      middleware(req, res, next);

      // Node.js lowercases header names, but let's test the lookup
      expect(req.id).toBe('req-mock-uuid-1234'); // Will use generated because headers are lowercase in Node
      expect(next).toHaveBeenCalled();
    });

    it('should handle empty string headers', () => {
      req.headers['x-request-id'] = '';
      req.headers['x-correlation-id'] = '';

      const middleware = requestId();
      middleware(req, res, next);

      expect(req.id).toBe('req-mock-uuid-1234');
      expect(res.setHeader).toHaveBeenCalledWith('X-Request-ID', 'req-mock-uuid-1234');
      expect(next).toHaveBeenCalled();
    });

    it('should handle special characters in request path', () => {
      req.app.locals.config.logRequests = true;
      req.path = '/test?query=param&foo=bar';

      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      const middleware = requestId();
      middleware(req, res, next);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[req-mock-uuid-1234] GET /test?query=param&foo=bar',
      );

      consoleLogSpy.mockRestore();
    });
  });
});
