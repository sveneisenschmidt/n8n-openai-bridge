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
    test('should parse comma-separated session ID headers', () => {
      process.env.SESSION_ID_HEADERS = 'X-Custom-Session,X-Chat-ID,X-Conversation';

      const config = new Config();

      expect(config.sessionIdHeaders).toEqual(['X-Custom-Session', 'X-Chat-ID', 'X-Conversation']);
    });

    test('should use default headers when env var is empty', () => {
      process.env.SESSION_ID_HEADERS = '';

      const config = new Config();

      expect(config.sessionIdHeaders).toEqual(['X-Session-Id', 'X-Chat-Id']);
    });

    test('should trim whitespace from header names', () => {
      process.env.SESSION_ID_HEADERS = ' X-Header-1 , X-Header-2 ,  X-Header-3  ';

      const config = new Config();

      expect(config.sessionIdHeaders).toEqual(['X-Header-1', 'X-Header-2', 'X-Header-3']);
    });
  });

  describe('parseUserIdHeaders', () => {
    test('should parse comma-separated user ID headers', () => {
      process.env.USER_ID_HEADERS = 'X-Custom-User,X-User-ID,X-OpenWebUI-User-Id';

      const config = new Config();

      expect(config.userIdHeaders).toEqual(['X-Custom-User', 'X-User-ID', 'X-OpenWebUI-User-Id']);
    });

    test('should use default headers when env var is empty', () => {
      process.env.USER_ID_HEADERS = '';

      const config = new Config();

      expect(config.userIdHeaders).toEqual(['X-User-Id']);
    });

    test('should trim whitespace from header names', () => {
      process.env.USER_ID_HEADERS = ' X-Header-1 , X-Header-2 ';

      const config = new Config();

      expect(config.userIdHeaders).toEqual(['X-Header-1', 'X-Header-2']);
    });
  });

  describe('parseUserEmailHeaders', () => {
    test('should parse comma-separated user email headers', () => {
      process.env.USER_EMAIL_HEADERS = 'X-Custom-Email,X-User-Email';

      const config = new Config();

      expect(config.userEmailHeaders).toEqual(['X-Custom-Email', 'X-User-Email']);
    });

    test('should use default headers when env var is empty', () => {
      process.env.USER_EMAIL_HEADERS = '';

      const config = new Config();

      expect(config.userEmailHeaders).toEqual(['X-User-Email']);
    });
  });

  describe('parseUserNameHeaders', () => {
    test('should parse comma-separated user name headers', () => {
      process.env.USER_NAME_HEADERS = 'X-Custom-Name,X-User-Name';

      const config = new Config();

      expect(config.userNameHeaders).toEqual(['X-Custom-Name', 'X-User-Name']);
    });

    test('should use default headers when env var is empty', () => {
      process.env.USER_NAME_HEADERS = '';

      const config = new Config();

      expect(config.userNameHeaders).toEqual(['X-User-Name']);
    });
  });

  describe('parseUserRoleHeaders', () => {
    test('should parse comma-separated user role headers', () => {
      process.env.USER_ROLE_HEADERS = 'X-Custom-Role,X-User-Role';

      const config = new Config();

      expect(config.userRoleHeaders).toEqual(['X-Custom-Role', 'X-User-Role']);
    });

    test('should use default headers when env var is empty', () => {
      process.env.USER_ROLE_HEADERS = '';

      const config = new Config();

      expect(config.userRoleHeaders).toEqual(['X-User-Role']);
    });
  });
});
