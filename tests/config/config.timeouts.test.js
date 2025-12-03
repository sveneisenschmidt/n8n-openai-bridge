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

const Config = require('../../src/config/Config');

// Mock console methods to reduce noise in test output
global.console = {
  ...console,
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

describe('Config - Timeout Configuration', () => {
  let originalEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.clearAllMocks();
  });

  describe('default values', () => {
    beforeEach(() => {
      delete process.env.N8N_TIMEOUT;
      delete process.env.SERVER_TIMEOUT;
      delete process.env.SERVER_KEEP_ALIVE_TIMEOUT;
      delete process.env.SERVER_HEADERS_TIMEOUT;
    });

    test('should use default N8N_TIMEOUT of 300000ms', () => {
      const config = new Config();
      expect(config.n8nTimeout).toBe(300000);
    });

    test('should use default SERVER_TIMEOUT of 300000ms', () => {
      const config = new Config();
      expect(config.serverTimeout).toBe(300000);
    });

    test('should use default SERVER_KEEP_ALIVE_TIMEOUT of 120000ms', () => {
      const config = new Config();
      expect(config.serverKeepAliveTimeout).toBe(120000);
    });

    test('should use default SERVER_HEADERS_TIMEOUT of 121000ms', () => {
      const config = new Config();
      expect(config.serverHeadersTimeout).toBe(121000);
    });
  });

  describe('custom values', () => {
    test('should load N8N_TIMEOUT from environment', () => {
      process.env.N8N_TIMEOUT = '600000';
      const config = new Config();
      expect(config.n8nTimeout).toBe(600000);
    });

    test('should load SERVER_TIMEOUT from environment', () => {
      process.env.SERVER_TIMEOUT = '180000';
      const config = new Config();
      expect(config.serverTimeout).toBe(180000);
    });

    test('should load SERVER_KEEP_ALIVE_TIMEOUT from environment', () => {
      process.env.SERVER_KEEP_ALIVE_TIMEOUT = '60000';
      const config = new Config();
      expect(config.serverKeepAliveTimeout).toBe(60000);
    });

    test('should load SERVER_HEADERS_TIMEOUT from environment', () => {
      process.env.SERVER_KEEP_ALIVE_TIMEOUT = '60000';
      process.env.SERVER_HEADERS_TIMEOUT = '65000';
      const config = new Config();
      expect(config.serverHeadersTimeout).toBe(65000);
    });
  });

  describe('validation', () => {
    test('should warn and use default when timeout is below 1000ms', () => {
      process.env.N8N_TIMEOUT = '500';
      const config = new Config();
      expect(config.n8nTimeout).toBe(300000);
      expect(console.warn).toHaveBeenCalledWith(
        'N8N_TIMEOUT must be a number >= 1000ms. Using default: 300000ms.',
      );
    });

    test('should warn and use default when timeout is not a number', () => {
      process.env.SERVER_TIMEOUT = 'invalid';
      const config = new Config();
      expect(config.serverTimeout).toBe(300000);
      expect(console.warn).toHaveBeenCalledWith(
        'SERVER_TIMEOUT must be a number >= 1000ms. Using default: 300000ms.',
      );
    });

    test('should warn and use default when timeout is negative', () => {
      process.env.SERVER_KEEP_ALIVE_TIMEOUT = '-5000';
      const config = new Config();
      expect(config.serverKeepAliveTimeout).toBe(120000);
      expect(console.warn).toHaveBeenCalledWith(
        'SERVER_KEEP_ALIVE_TIMEOUT must be a number >= 1000ms. Using default: 120000ms.',
      );
    });

    test('should handle empty string as default', () => {
      process.env.N8N_TIMEOUT = '';
      const config = new Config();
      expect(config.n8nTimeout).toBe(300000);
    });

    test('should handle whitespace-only string as default', () => {
      process.env.N8N_TIMEOUT = '   ';
      const config = new Config();
      expect(config.n8nTimeout).toBe(300000);
    });

    test('should accept exactly 1000ms as minimum valid value', () => {
      process.env.N8N_TIMEOUT = '1000';
      const config = new Config();
      expect(config.n8nTimeout).toBe(1000);
      expect(console.warn).not.toHaveBeenCalled();
    });
  });

  describe('headers timeout validation', () => {
    test('should adjust headers timeout when equal to keep-alive timeout', () => {
      process.env.SERVER_KEEP_ALIVE_TIMEOUT = '60000';
      process.env.SERVER_HEADERS_TIMEOUT = '60000';
      const config = new Config();
      expect(config.serverHeadersTimeout).toBe(61000);
      expect(console.warn).toHaveBeenCalledWith(
        'SERVER_HEADERS_TIMEOUT (60000) must be greater than SERVER_KEEP_ALIVE_TIMEOUT (60000). Adjusting to 61000ms.',
      );
    });

    test('should adjust headers timeout when less than keep-alive timeout', () => {
      process.env.SERVER_KEEP_ALIVE_TIMEOUT = '60000';
      process.env.SERVER_HEADERS_TIMEOUT = '50000';
      const config = new Config();
      expect(config.serverHeadersTimeout).toBe(61000);
      expect(console.warn).toHaveBeenCalledWith(
        'SERVER_HEADERS_TIMEOUT (50000) must be greater than SERVER_KEEP_ALIVE_TIMEOUT (60000). Adjusting to 61000ms.',
      );
    });

    test('should not adjust headers timeout when greater than keep-alive timeout', () => {
      process.env.SERVER_KEEP_ALIVE_TIMEOUT = '60000';
      process.env.SERVER_HEADERS_TIMEOUT = '65000';
      const config = new Config();
      expect(config.serverHeadersTimeout).toBe(65000);
    });
  });
});
