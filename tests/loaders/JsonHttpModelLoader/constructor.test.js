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

const JsonHttpModelLoader = require('../../../src/loaders/JsonHttpModelLoader');
const axios = require('axios');

jest.mock('axios');

describe('JsonHttpModelLoader - Constructor', () => {
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
    const loader = new JsonHttpModelLoader({
      JSON_HTTP_ENDPOINT: 'https://api.example.com/models',
      JSON_HTTP_POLL_INTERVAL: '300',
      JSON_HTTP_TIMEOUT: '10000',
    });

    expect(loader.endpoint).toBe('https://api.example.com/models');
    expect(loader.pollingInterval).toBe(300);
    expect(loader.timeout).toBe(10000);
  });

  test('should validate and normalize endpoint URL', () => {
    const loader = new JsonHttpModelLoader({
      JSON_HTTP_ENDPOINT: 'https://api.example.com/models/',
      JSON_HTTP_POLL_INTERVAL: '300',
      JSON_HTTP_TIMEOUT: '10000',
    });

    // URL constructor normalizes the URL
    expect(loader.endpoint).toBe('https://api.example.com/models/');
  });

  test('should throw error for invalid endpoint URL', () => {
    expect(() => {
      new JsonHttpModelLoader({
        JSON_HTTP_ENDPOINT: 'not-a-valid-url',
        JSON_HTTP_POLL_INTERVAL: '300',
        JSON_HTTP_TIMEOUT: '10000',
      });
    }).toThrow('Invalid JSON_HTTP_ENDPOINT URL');
  });

  test('should validate timeout is at least 1000ms', () => {
    expect(() => {
      new JsonHttpModelLoader({
        JSON_HTTP_ENDPOINT: 'https://api.example.com/models',
        JSON_HTTP_POLL_INTERVAL: '300',
        JSON_HTTP_TIMEOUT: '500',
      });
    }).toThrow('JSON_HTTP_TIMEOUT must be >= 1000 milliseconds');
  });

  test('should validate polling interval (min 60 seconds)', () => {
    const loader = new JsonHttpModelLoader({
      JSON_HTTP_ENDPOINT: 'https://api.example.com/models',
      JSON_HTTP_POLL_INTERVAL: '30',
      JSON_HTTP_TIMEOUT: '10000',
    });

    expect(loader.pollingInterval).toBe(60);
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Polling interval 30s is too low'),
    );
  });

  test('should validate polling interval (max 600 seconds)', () => {
    const loader = new JsonHttpModelLoader({
      JSON_HTTP_ENDPOINT: 'https://api.example.com/models',
      JSON_HTTP_POLL_INTERVAL: '1000',
      JSON_HTTP_TIMEOUT: '10000',
    });

    expect(loader.pollingInterval).toBe(600);
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Polling interval 1000s is too high'),
    );
  });

  test('should allow polling interval of 0 (disabled)', () => {
    const loader = new JsonHttpModelLoader({
      JSON_HTTP_ENDPOINT: 'https://api.example.com/models',
      JSON_HTTP_POLL_INTERVAL: '0',
      JSON_HTTP_TIMEOUT: '10000',
    });

    expect(loader.pollingInterval).toBe(0);
  });

  test('should throw error for negative polling interval', () => {
    expect(() => {
      new JsonHttpModelLoader({
        JSON_HTTP_ENDPOINT: 'https://api.example.com/models',
        JSON_HTTP_POLL_INTERVAL: '-10',
        JSON_HTTP_TIMEOUT: '10000',
      });
    }).toThrow('Polling interval must be >= 0');
  });

  test('should configure axios instance with timeout', () => {
    const mockAxiosCreate = jest.fn(() => ({
      get: jest.fn(),
    }));
    axios.create = mockAxiosCreate;

    new JsonHttpModelLoader({
      JSON_HTTP_ENDPOINT: 'https://api.example.com/models',
      JSON_HTTP_POLL_INTERVAL: '300',
      JSON_HTTP_TIMEOUT: '15000',
    });

    expect(mockAxiosCreate).toHaveBeenCalledWith({
      timeout: 15000,
    });
  });

  test('should use default values for optional env vars', () => {
    const loader = new JsonHttpModelLoader({
      JSON_HTTP_ENDPOINT: 'https://api.example.com/models',
      JSON_HTTP_POLL_INTERVAL: '300',
      JSON_HTTP_TIMEOUT: '10000',
    });

    expect(loader.pollingInterval).toBe(300);
    expect(loader.timeout).toBe(10000);
  });
});
