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

describe('JsonHttpModelLoader - load', () => {
  let consoleLogSpy;

  beforeAll(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
  });

  afterAll(() => {
    consoleLogSpy.mockRestore();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should load and validate models successfully', async () => {
    const mockResponse = {
      'gpt-4': 'https://webhook.example.com/gpt4',
      'claude-3': 'https://webhook.example.com/claude',
    };

    const mockGet = jest.fn().mockResolvedValue({
      data: mockResponse,
    });

    const loader = new JsonHttpModelLoader({
      JSON_HTTP_ENDPOINT: 'https://api.example.com/models',
      JSON_HTTP_POLL_INTERVAL: '300',
      JSON_HTTP_TIMEOUT: '10000',
    });

    loader.axiosInstance = { get: mockGet };

    const models = await loader.load();

    expect(models).toEqual(mockResponse);
    expect(mockGet).toHaveBeenCalledWith('https://api.example.com/models');
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('Fetched models from HTTP endpoint'),
    );
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('Loaded 2 models from HTTP endpoint'),
    );
  });

  test('should throw error if response is not an object', async () => {
    const mockGet = jest.fn().mockResolvedValue({
      data: ['model1', 'model2'],
    });

    const loader = new JsonHttpModelLoader({
      JSON_HTTP_ENDPOINT: 'https://api.example.com/models',
      JSON_HTTP_POLL_INTERVAL: '300',
      JSON_HTTP_TIMEOUT: '10000',
    });

    loader.axiosInstance = { get: mockGet };

    await expect(loader.load()).rejects.toThrow('Response must be a JSON object');
  });

  test('should throw error if response is null', async () => {
    const mockGet = jest.fn().mockResolvedValue({
      data: null,
    });

    const loader = new JsonHttpModelLoader({
      JSON_HTTP_ENDPOINT: 'https://api.example.com/models',
      JSON_HTTP_POLL_INTERVAL: '300',
      JSON_HTTP_TIMEOUT: '10000',
    });

    loader.axiosInstance = { get: mockGet };

    await expect(loader.load()).rejects.toThrow('Response must be a JSON object');
  });

  test('should throw error if response is a primitive value', async () => {
    const mockGet = jest.fn().mockResolvedValue({
      data: 'not an object',
    });

    const loader = new JsonHttpModelLoader({
      JSON_HTTP_ENDPOINT: 'https://api.example.com/models',
      JSON_HTTP_POLL_INTERVAL: '300',
      JSON_HTTP_TIMEOUT: '10000',
    });

    loader.axiosInstance = { get: mockGet };

    await expect(loader.load()).rejects.toThrow('Response must be a JSON object');
  });

  test('should throw descriptive error on 401 Unauthorized', async () => {
    const mockGet = jest.fn().mockRejectedValue({
      response: {
        status: 401,
        data: { message: 'Unauthorized' },
      },
    });

    const loader = new JsonHttpModelLoader({
      JSON_HTTP_ENDPOINT: 'https://api.example.com/models',
      JSON_HTTP_POLL_INTERVAL: '300',
      JSON_HTTP_TIMEOUT: '10000',
    });

    loader.axiosInstance = { get: mockGet };

    await expect(loader.load()).rejects.toThrow('401 Unauthorized');
  });

  test('should throw descriptive error on 403 Forbidden', async () => {
    const mockGet = jest.fn().mockRejectedValue({
      response: {
        status: 403,
        data: { message: 'Forbidden' },
      },
    });

    const loader = new JsonHttpModelLoader({
      JSON_HTTP_ENDPOINT: 'https://api.example.com/models',
      JSON_HTTP_POLL_INTERVAL: '300',
      JSON_HTTP_TIMEOUT: '10000',
    });

    loader.axiosInstance = { get: mockGet };

    await expect(loader.load()).rejects.toThrow('403 Forbidden');
  });

  test('should throw descriptive error on 404 Not Found', async () => {
    const mockGet = jest.fn().mockRejectedValue({
      response: {
        status: 404,
        data: { message: 'Not found' },
      },
    });

    const loader = new JsonHttpModelLoader({
      JSON_HTTP_ENDPOINT: 'https://api.example.com/models',
      JSON_HTTP_POLL_INTERVAL: '300',
      JSON_HTTP_TIMEOUT: '10000',
    });

    loader.axiosInstance = { get: mockGet };

    await expect(loader.load()).rejects.toThrow('404 Not Found');
  });

  test('should throw descriptive error on other HTTP errors', async () => {
    const mockGet = jest.fn().mockRejectedValue({
      response: {
        status: 500,
        data: { message: 'Internal Server Error' },
      },
    });

    const loader = new JsonHttpModelLoader({
      JSON_HTTP_ENDPOINT: 'https://api.example.com/models',
      JSON_HTTP_POLL_INTERVAL: '300',
      JSON_HTTP_TIMEOUT: '10000',
    });

    loader.axiosInstance = { get: mockGet };

    await expect(loader.load()).rejects.toThrow('HTTP endpoint error (500)');
  });

  test('should throw descriptive error on network failure', async () => {
    const mockGet = jest.fn().mockRejectedValue({
      request: {},
      message: 'Network Error',
    });

    const loader = new JsonHttpModelLoader({
      JSON_HTTP_ENDPOINT: 'https://api.example.com/models',
      JSON_HTTP_POLL_INTERVAL: '300',
      JSON_HTTP_TIMEOUT: '10000',
    });

    loader.axiosInstance = { get: mockGet };

    await expect(loader.load()).rejects.toThrow('Cannot reach HTTP endpoint');
  });

  test('should filter invalid models with warnings', async () => {
    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

    const mockResponse = {
      'valid-model': 'https://webhook.example.com/valid',
      'invalid-model': 'not-a-url',
      '': 'https://webhook.example.com/empty-id',
    };

    const mockGet = jest.fn().mockResolvedValue({
      data: mockResponse,
    });

    const loader = new JsonHttpModelLoader({
      JSON_HTTP_ENDPOINT: 'https://api.example.com/models',
      JSON_HTTP_POLL_INTERVAL: '300',
      JSON_HTTP_TIMEOUT: '10000',
    });

    loader.axiosInstance = { get: mockGet };

    const models = await loader.load();

    expect(models).toEqual({
      'valid-model': 'https://webhook.example.com/valid',
    });

    consoleWarnSpy.mockRestore();
  });
});
