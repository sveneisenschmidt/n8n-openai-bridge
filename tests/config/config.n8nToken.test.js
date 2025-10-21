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

describe('Config - N8N Webhook Bearer Token', () => {
  let originalEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.clearAllMocks();
  });

  test('should use N8N_WEBHOOK_BEARER_TOKEN when set', async () => {
    process.env.MODEL_LOADER_TYPE = 'static';
    process.env.N8N_WEBHOOK_BEARER_TOKEN = 'new-token';
    process.env.N8N_BEARER_TOKEN = 'old-token';
    jest.resetModules();
    const config = require('../../src/config');
    await config.loadingPromise;

    expect(config.n8nWebhookBearerToken).toBe('new-token');
  });

  test('should fall back to N8N_BEARER_TOKEN for backwards compatibility', async () => {
    process.env.MODEL_LOADER_TYPE = 'static';
    delete process.env.N8N_WEBHOOK_BEARER_TOKEN;
    process.env.N8N_BEARER_TOKEN = 'old-token';
    jest.resetModules();
    const config = require('../../src/config');
    await config.loadingPromise;

    expect(config.n8nWebhookBearerToken).toBe('old-token');
  });

  test('should warn when using deprecated N8N_BEARER_TOKEN', async () => {
    process.env.MODEL_LOADER_TYPE = 'static';
    delete process.env.N8N_WEBHOOK_BEARER_TOKEN;
    process.env.N8N_BEARER_TOKEN = 'old-token';
    jest.resetModules();
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation();

    const config = require('../../src/config');
    await config.loadingPromise;

    expect(warnSpy).toHaveBeenCalledWith(
      'N8N_BEARER_TOKEN is deprecated, please use N8N_WEBHOOK_BEARER_TOKEN instead',
    );

    warnSpy.mockRestore();
  });

  test('should prefer N8N_WEBHOOK_BEARER_TOKEN over N8N_BEARER_TOKEN', async () => {
    process.env.MODEL_LOADER_TYPE = 'static';
    process.env.N8N_WEBHOOK_BEARER_TOKEN = 'new-token';
    process.env.N8N_BEARER_TOKEN = 'old-token';
    jest.resetModules();
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation();

    const config = require('../../src/config');
    await config.loadingPromise;

    expect(config.n8nWebhookBearerToken).toBe('new-token');
    expect(warnSpy).not.toHaveBeenCalled();

    warnSpy.mockRestore();
  });

  test('should return empty string when no token is set', async () => {
    process.env.MODEL_LOADER_TYPE = 'static';
    delete process.env.N8N_WEBHOOK_BEARER_TOKEN;
    delete process.env.N8N_BEARER_TOKEN;
    jest.resetModules();
    const config = require('../../src/config');
    await config.loadingPromise;

    expect(config.n8nWebhookBearerToken).toBe('');
  });
});
