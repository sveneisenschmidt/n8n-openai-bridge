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

const N8nApiModelLoader = require('../../../src/loaders/N8nApiModelLoader');
const axios = require('axios');

jest.mock('axios');

describe('N8nApiModelLoader - Constructor', () => {
  let consoleLogSpy;
  let consoleWarnSpy;

  beforeAll(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
  });

  afterAll(() => {
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should initialize with valid parameters', () => {
    const loader = new N8nApiModelLoader({
      N8N_BASE_URL: 'https://n8n.example.com',
      N8N_API_BEARER_TOKEN: 'test-token',
      AUTO_DISCOVERY_TAG: 'n8n-openai-bridge',
      AUTO_DISCOVERY_POLLING: '300',
    });

    expect(loader.n8nBaseUrl).toBe('https://n8n.example.com');
    expect(loader.apiToken).toBe('test-token');
    expect(loader.tag).toBe('n8n-openai-bridge');
    expect(loader.pollingInterval).toBe(300);
  });

  test('should remove trailing slash from base URL', () => {
    const loader = new N8nApiModelLoader({
      N8N_BASE_URL: 'https://n8n.example.com/',
      N8N_API_BEARER_TOKEN: 'test-token',
      AUTO_DISCOVERY_TAG: 'n8n-openai-bridge',
      AUTO_DISCOVERY_POLLING: '300',
    });

    expect(loader.n8nBaseUrl).toBe('https://n8n.example.com');
  });

  test('should validate polling interval (min 60 seconds)', () => {
    const loader = new N8nApiModelLoader({
      N8N_BASE_URL: 'https://n8n.example.com',
      N8N_API_BEARER_TOKEN: 'test-token',
      AUTO_DISCOVERY_TAG: 'n8n-openai-bridge',
      AUTO_DISCOVERY_POLLING: '30',
    });

    expect(loader.pollingInterval).toBe(60);
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Polling interval 30s is too low'),
    );
  });

  test('should validate polling interval (max 600 seconds)', () => {
    const loader = new N8nApiModelLoader({
      N8N_BASE_URL: 'https://n8n.example.com',
      N8N_API_BEARER_TOKEN: 'test-token',
      AUTO_DISCOVERY_TAG: 'n8n-openai-bridge',
      AUTO_DISCOVERY_POLLING: '1000',
    });

    expect(loader.pollingInterval).toBe(600);
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Polling interval 1000s is too high'),
    );
  });

  test('should allow polling interval of 0 (disabled)', () => {
    const loader = new N8nApiModelLoader({
      N8N_BASE_URL: 'https://n8n.example.com',
      N8N_API_BEARER_TOKEN: 'test-token',
      AUTO_DISCOVERY_TAG: 'n8n-openai-bridge',
      AUTO_DISCOVERY_POLLING: '0',
    });

    expect(loader.pollingInterval).toBe(0);
  });

  test('should throw error for negative polling interval', () => {
    expect(() => {
      new N8nApiModelLoader({
        N8N_BASE_URL: 'https://n8n.example.com',
        N8N_API_BEARER_TOKEN: 'test-token',
        AUTO_DISCOVERY_TAG: 'n8n-openai-bridge',
        AUTO_DISCOVERY_POLLING: '-10',
      });
    }).toThrow('Polling interval must be >= 0');
  });

  test('should configure axios instance with correct headers', () => {
    const mockAxiosCreate = jest.fn(() => ({
      get: jest.fn(),
    }));
    axios.create = mockAxiosCreate;

    new N8nApiModelLoader({
      N8N_BASE_URL: 'https://n8n.example.com',
      N8N_API_BEARER_TOKEN: 'test-token-123',
      AUTO_DISCOVERY_TAG: 'n8n-openai-bridge',
      AUTO_DISCOVERY_POLLING: '300',
    });

    expect(mockAxiosCreate).toHaveBeenCalledWith({
      baseURL: 'https://n8n.example.com',
      headers: {
        'X-N8N-API-KEY': 'test-token-123',
      },
      timeout: 10000,
    });
  });
});
