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

const createRateLimiters = require('../../src/middleware/rateLimiter');

// Mock express-rate-limit
jest.mock('express-rate-limit', () => {
  return jest.fn((options) => {
    // Create a mock middleware function
    const middleware = jest.fn((req, res, next) => {
      // Check if should skip
      if (options.skip && options.skip(req)) {
        return next();
      }

      // Simulate rate limit exceeded
      if (req.testRateLimitExceeded) {
        if (options.handler) {
          return options.handler(req, res);
        }
        return res.status(429).json({ error: options.message });
      }

      next();
    });

    // Store options for testing
    middleware.options = options;

    return middleware;
  });
});

describe('rateLimiter', () => {
  let originalEnv;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };
    // Clear rate limit environment variables
    delete process.env.RATE_LIMIT_WINDOW_MS;
    delete process.env.RATE_LIMIT_MAX_REQUESTS;
    delete process.env.RATE_LIMIT_CHAT_COMPLETIONS;
    delete process.env.DISABLE_RATE_LIMIT;
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
    jest.clearAllMocks();
  });

  describe('createRateLimiters', () => {
    it('should create rate limiters with default settings', () => {
      const config = { logRequests: false };
      const limiters = createRateLimiters(config);

      expect(limiters).toHaveProperty('standard');
      expect(limiters).toHaveProperty('chatCompletions');
      expect(limiters).toHaveProperty('health');

      // Check default options
      expect(limiters.standard.options.windowMs).toBe(60000);
      expect(limiters.standard.options.max).toBe(100);
      expect(limiters.chatCompletions.options.max).toBe(30);
      expect(limiters.health.options.max).toBe(1000);
    });

    it('should use custom environment settings', () => {
      process.env.RATE_LIMIT_WINDOW_MS = '120000';
      process.env.RATE_LIMIT_MAX_REQUESTS = '200';
      process.env.RATE_LIMIT_CHAT_COMPLETIONS = '50';

      const config = { logRequests: false };
      const limiters = createRateLimiters(config);

      expect(limiters.standard.options.windowMs).toBe(120000);
      expect(limiters.standard.options.max).toBe(200);
      expect(limiters.chatCompletions.options.max).toBe(50);
      expect(limiters.health.options.max).toBe(2000); // 10x standard
    });

    it('should skip rate limiting when DISABLE_RATE_LIMIT is true', () => {
      process.env.DISABLE_RATE_LIMIT = 'true';

      const config = { logRequests: false };
      const limiters = createRateLimiters(config);

      const req = {};
      expect(limiters.standard.options.skip(req)).toBe(true);
      expect(limiters.chatCompletions.options.skip(req)).toBe(true);
      expect(limiters.health.options.skip(req)).toBe(true);
    });

    it('should not skip rate limiting when DISABLE_RATE_LIMIT is false', () => {
      process.env.DISABLE_RATE_LIMIT = 'false';

      const config = { logRequests: false };
      const limiters = createRateLimiters(config);

      const req = {};
      expect(limiters.standard.options.skip(req)).toBe(false);
      expect(limiters.chatCompletions.options.skip(req)).toBe(false);
      expect(limiters.health.options.skip(req)).toBe(false);
    });

    it('should handle rate limit exceeded for standard limiter', () => {
      const config = { logRequests: true };
      const limiters = createRateLimiters(config);

      const req = {
        testRateLimitExceeded: true,
        id: 'test-123',
        ip: '127.0.0.1',
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      // Mock console.log to verify logging
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      // Call the handler
      limiters.standard.options.handler(req, res);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[test-123] Rate limit exceeded for IP: 127.0.0.1',
      );
      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          message: 'Too many requests, please try again later',
          type: 'rate_limit_error',
        },
      });

      consoleLogSpy.mockRestore();
    });

    it('should handle rate limit exceeded for chat completions limiter', () => {
      const config = { logRequests: true };
      const limiters = createRateLimiters(config);

      const req = {
        testRateLimitExceeded: true,
        id: 'test-456',
        ip: '192.168.1.1',
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      // Mock console.log to verify logging
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      // Call the handler
      limiters.chatCompletions.options.handler(req, res);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[test-456] Chat completions rate limit exceeded for IP: 192.168.1.1',
      );
      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          message: 'Too many chat completion requests, please try again later',
          type: 'rate_limit_error',
        },
      });

      consoleLogSpy.mockRestore();
    });

    it('should not log when logRequests is false', () => {
      const config = { logRequests: false };
      const limiters = createRateLimiters(config);

      const req = {
        testRateLimitExceeded: true,
        id: 'test-789',
        ip: '10.0.0.1',
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      // Mock console.log to verify it's not called
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      // Call the handler
      limiters.standard.options.handler(req, res);

      expect(consoleLogSpy).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(429);

      consoleLogSpy.mockRestore();
    });

    it('should set correct headers for standard limiter', () => {
      const config = { logRequests: false };
      const limiters = createRateLimiters(config);

      expect(limiters.standard.options.standardHeaders).toBe(true);
      expect(limiters.standard.options.legacyHeaders).toBe(false);
    });

    it('should set correct headers for chat completions limiter', () => {
      const config = { logRequests: false };
      const limiters = createRateLimiters(config);

      expect(limiters.chatCompletions.options.standardHeaders).toBe(true);
      expect(limiters.chatCompletions.options.legacyHeaders).toBe(false);
    });

    it('should not set headers for health check limiter', () => {
      const config = { logRequests: false };
      const limiters = createRateLimiters(config);

      expect(limiters.health.options.standardHeaders).toBe(false);
      expect(limiters.health.options.legacyHeaders).toBe(false);
    });
  });
});
