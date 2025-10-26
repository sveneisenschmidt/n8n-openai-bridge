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

describe('Config - Basic Properties', () => {
  let originalEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.clearAllMocks();
  });

  test('should load configuration from environment variables', () => {
    process.env.PORT = '3333';
    process.env.BEARER_TOKEN = 'test-token';
    process.env.LOG_REQUESTS = 'false';

    const config = new Config();

    expect(config.port).toBe('3333');
    expect(config.bearerToken).toBe('test-token');
    expect(config.logRequests).toBe(false);
  });

  test('should use default values when env vars are not set', () => {
    delete process.env.PORT;
    delete process.env.BEARER_TOKEN;
    delete process.env.LOG_REQUESTS;

    const config = new Config();

    expect(config.port).toBe(3333);
    expect(config.bearerToken).toBe('');
    expect(config.logRequests).toBe(false);
  });
});
