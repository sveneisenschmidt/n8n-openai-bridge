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

// Mock console methods to reduce noise in test output
global.console = {
  ...console,
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

describe('Config - Header Parsing', () => {
  let originalEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.clearAllMocks();
  });

  describe('parseSessionIdHeaders', () => {
    test('should parse comma-separated session ID headers', async () => {
      process.env.MODEL_LOADER_TYPE = 'static';
      process.env.SESSION_ID_HEADERS = 'X-Custom-Session,X-Chat-ID,X-Conversation';
      jest.resetModules();
      const config = require('../../src/config');
      await config.loadingPromise;

      expect(config.sessionIdHeaders).toEqual(['X-Custom-Session', 'X-Chat-ID', 'X-Conversation']);
    });

    test('should use default headers when env var is empty', async () => {
      process.env.MODEL_LOADER_TYPE = 'static';
      process.env.SESSION_ID_HEADERS = '';
      jest.resetModules();
      const config = require('../../src/config');
      await config.loadingPromise;

      expect(config.sessionIdHeaders).toEqual(['X-Session-Id', 'X-Chat-Id']);
    });

    test('should trim whitespace from header names', async () => {
      process.env.MODEL_LOADER_TYPE = 'static';
      process.env.SESSION_ID_HEADERS = ' X-Header-1 , X-Header-2 ,  X-Header-3  ';
      jest.resetModules();
      const config = require('../../src/config');
      await config.loadingPromise;

      expect(config.sessionIdHeaders).toEqual(['X-Header-1', 'X-Header-2', 'X-Header-3']);
    });
  });

  describe('parseUserIdHeaders', () => {
    test('should parse comma-separated user ID headers', async () => {
      process.env.MODEL_LOADER_TYPE = 'static';
      process.env.USER_ID_HEADERS = 'X-Custom-User,X-User-ID,X-OpenWebUI-User-Id';
      jest.resetModules();
      const config = require('../../src/config');
      await config.loadingPromise;

      expect(config.userIdHeaders).toEqual(['X-Custom-User', 'X-User-ID', 'X-OpenWebUI-User-Id']);
    });

    test('should use default headers when env var is empty', async () => {
      process.env.MODEL_LOADER_TYPE = 'static';
      process.env.USER_ID_HEADERS = '';
      jest.resetModules();
      const config = require('../../src/config');
      await config.loadingPromise;

      expect(config.userIdHeaders).toEqual(['X-User-Id']);
    });

    test('should trim whitespace from header names', async () => {
      process.env.MODEL_LOADER_TYPE = 'static';
      process.env.USER_ID_HEADERS = ' X-User-1 , X-User-2 ,  X-User-3  ';
      jest.resetModules();
      const config = require('../../src/config');
      await config.loadingPromise;

      expect(config.userIdHeaders).toEqual(['X-User-1', 'X-User-2', 'X-User-3']);
    });
  });

  describe('parseUserEmailHeaders', () => {
    test('should parse comma-separated user email headers', async () => {
      process.env.MODEL_LOADER_TYPE = 'static';
      process.env.USER_EMAIL_HEADERS = 'X-Email,X-User-Email,X-OpenWebUI-User-Email';
      jest.resetModules();
      const config = require('../../src/config');
      await config.loadingPromise;

      expect(config.userEmailHeaders).toEqual([
        'X-Email',
        'X-User-Email',
        'X-OpenWebUI-User-Email',
      ]);
    });

    test('should use default headers when env var is empty', async () => {
      process.env.MODEL_LOADER_TYPE = 'static';
      process.env.USER_EMAIL_HEADERS = '';
      jest.resetModules();
      const config = require('../../src/config');
      await config.loadingPromise;

      expect(config.userEmailHeaders).toEqual(['X-User-Email']);
    });
  });

  describe('parseUserNameHeaders', () => {
    test('should parse comma-separated user name headers', async () => {
      process.env.MODEL_LOADER_TYPE = 'static';
      process.env.USER_NAME_HEADERS = 'X-Name,X-User-Name,X-OpenWebUI-User-Name';
      jest.resetModules();
      const config = require('../../src/config');
      await config.loadingPromise;

      expect(config.userNameHeaders).toEqual(['X-Name', 'X-User-Name', 'X-OpenWebUI-User-Name']);
    });

    test('should use default headers when env var is empty', async () => {
      process.env.MODEL_LOADER_TYPE = 'static';
      process.env.USER_NAME_HEADERS = '';
      jest.resetModules();
      const config = require('../../src/config');
      await config.loadingPromise;

      expect(config.userNameHeaders).toEqual(['X-User-Name']);
    });
  });

  describe('parseUserRoleHeaders', () => {
    test('should parse comma-separated user role headers', async () => {
      process.env.MODEL_LOADER_TYPE = 'static';
      process.env.USER_ROLE_HEADERS = 'X-Role,X-User-Role,X-OpenWebUI-User-Role';
      jest.resetModules();
      const config = require('../../src/config');
      await config.loadingPromise;

      expect(config.userRoleHeaders).toEqual(['X-Role', 'X-User-Role', 'X-OpenWebUI-User-Role']);
    });

    test('should use default headers when env var is empty', async () => {
      process.env.MODEL_LOADER_TYPE = 'static';
      process.env.USER_ROLE_HEADERS = '';
      jest.resetModules();
      const config = require('../../src/config');
      await config.loadingPromise;

      expect(config.userRoleHeaders).toEqual(['X-User-Role']);
    });
  });
});
