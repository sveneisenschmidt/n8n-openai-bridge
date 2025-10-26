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

describe('Config - N8N Webhook Bearer Token', () => {
  let originalEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.clearAllMocks();
  });

  test('should use N8N_WEBHOOK_BEARER_TOKEN when set', () => {
    process.env.N8N_WEBHOOK_BEARER_TOKEN = 'new-token';
    process.env.N8N_BEARER_TOKEN = 'old-token';

    const config = new Config();

    expect(config.n8nWebhookBearerToken).toBe('new-token');
  });

  test('should fall back to N8N_BEARER_TOKEN for backwards compatibility', () => {
    delete process.env.N8N_WEBHOOK_BEARER_TOKEN;
    process.env.N8N_BEARER_TOKEN = 'old-token';

    const config = new Config();

    expect(config.n8nWebhookBearerToken).toBe('old-token');
  });

  test('should warn when using deprecated N8N_BEARER_TOKEN', () => {
    delete process.env.N8N_WEBHOOK_BEARER_TOKEN;
    process.env.N8N_BEARER_TOKEN = 'old-token';
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation();

    new Config();

    expect(warnSpy).toHaveBeenCalledWith(
      'N8N_BEARER_TOKEN is deprecated, please use N8N_WEBHOOK_BEARER_TOKEN instead',
    );

    warnSpy.mockRestore();
  });

  test('should prefer N8N_WEBHOOK_BEARER_TOKEN over N8N_BEARER_TOKEN', () => {
    process.env.N8N_WEBHOOK_BEARER_TOKEN = 'new-token';
    process.env.N8N_BEARER_TOKEN = 'old-token';
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation();

    const config = new Config();

    expect(config.n8nWebhookBearerToken).toBe('new-token');
    expect(warnSpy).not.toHaveBeenCalled();

    warnSpy.mockRestore();
  });

  test('should return empty string when no token is set', () => {
    delete process.env.N8N_WEBHOOK_BEARER_TOKEN;
    delete process.env.N8N_BEARER_TOKEN;

    const config = new Config();

    expect(config.n8nWebhookBearerToken).toBe('');
  });
});
