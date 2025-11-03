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

describe('JsonHttpModelLoader - Polling', () => {
  let consoleLogSpy;
  let consoleWarnSpy;
  let consoleErrorSpy;
  let loaders = [];

  beforeAll(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterAll(() => {
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  beforeEach(() => {
    loaders = [];
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    // Stop all loaders
    loaders.forEach((loader) => {
      if (loader) {
        loader.stopWatching();
      }
    });
    loaders = [];

    jest.clearAllTimers();
    jest.useRealTimers();
  });

  describe('watch', () => {
    test('should start polling when interval is not 0', async () => {
      const mockGet = jest.fn().mockResolvedValue({
        data: {
          'gpt-4': 'https://webhook.example.com/gpt4',
        },
      });

      const loader = new JsonHttpModelLoader({
        JSON_HTTP_ENDPOINT: 'https://api.example.com/models',
        JSON_HTTP_POLL_INTERVAL: '300',
        JSON_HTTP_TIMEOUT: '10000',
      });
      loaders.push(loader);

      loader.axiosInstance = { get: mockGet };

      const callback = jest.fn();
      loader.watch(callback);

      expect(loader.pollingTimer).not.toBeNull();
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Starting polling every 300s'),
      );

      // Trigger polling
      await jest.advanceTimersByTimeAsync(300 * 1000);

      expect(mockGet).toHaveBeenCalled();
      expect(callback).toHaveBeenCalledWith({
        'gpt-4': 'https://webhook.example.com/gpt4',
      });
    });

    test('should not start polling when interval is 0', () => {
      const loader = new JsonHttpModelLoader({
        JSON_HTTP_ENDPOINT: 'https://api.example.com/models',
        JSON_HTTP_POLL_INTERVAL: '0',
        JSON_HTTP_TIMEOUT: '10000',
      });
      loaders.push(loader);

      const callback = jest.fn();
      loader.watch(callback);

      expect(loader.pollingTimer).toBeNull();
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Polling disabled'));
    });

    test('should not watch twice', () => {
      const loader = new JsonHttpModelLoader({
        JSON_HTTP_ENDPOINT: 'https://api.example.com/models',
        JSON_HTTP_POLL_INTERVAL: '300',
        JSON_HTTP_TIMEOUT: '10000',
      });
      loaders.push(loader);

      loader.watch(() => {});
      loader.watch(() => {});

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Polling already active'),
      );
    });

    test('should continue polling on errors', async () => {
      let callCount = 0;
      const mockGet = jest.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.reject(new Error('API Error'));
        }
        return Promise.resolve({
          data: {
            'gpt-4': 'https://webhook.example.com/gpt4',
          },
        });
      });

      const loader = new JsonHttpModelLoader({
        JSON_HTTP_ENDPOINT: 'https://api.example.com/models',
        JSON_HTTP_POLL_INTERVAL: '300',
        JSON_HTTP_TIMEOUT: '10000',
      });
      loaders.push(loader);

      loader.axiosInstance = { get: mockGet };

      const callback = jest.fn();
      loader.watch(callback);

      // First poll - should error
      await jest.advanceTimersByTimeAsync(300 * 1000);

      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Polling error'));
      expect(callback).not.toHaveBeenCalled();

      // Second poll - should succeed
      await jest.advanceTimersByTimeAsync(300 * 1000);

      expect(callback).toHaveBeenCalledWith({
        'gpt-4': 'https://webhook.example.com/gpt4',
      });
    });

    test('should only fire callback when models change', async () => {
      const mockGet = jest.fn().mockResolvedValue({
        data: {
          'gpt-4': 'https://webhook.example.com/gpt4',
        },
      });

      const loader = new JsonHttpModelLoader({
        JSON_HTTP_ENDPOINT: 'https://api.example.com/models',
        JSON_HTTP_POLL_INTERVAL: '300',
        JSON_HTTP_TIMEOUT: '10000',
      });
      loaders.push(loader);

      loader.axiosInstance = { get: mockGet };

      const callback = jest.fn();
      loader.watch(callback);

      // First poll - should fire callback (models changed from null to data)
      await jest.advanceTimersByTimeAsync(300 * 1000);

      expect(callback).toHaveBeenCalledTimes(1);

      // Second poll - should NOT fire callback (same models)
      await jest.advanceTimersByTimeAsync(300 * 1000);

      expect(callback).toHaveBeenCalledTimes(1);

      // Third poll - should NOT fire callback (still same models)
      await jest.advanceTimersByTimeAsync(300 * 1000);

      expect(callback).toHaveBeenCalledTimes(1);
    });

    test('should fire callback when models change', async () => {
      let callCount = 0;
      const mockGet = jest.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            data: {
              'gpt-4': 'https://webhook.example.com/gpt4',
            },
          });
        }
        return Promise.resolve({
          data: {
            'gpt-4': 'https://webhook.example.com/gpt4',
            'claude-3': 'https://webhook.example.com/claude',
          },
        });
      });

      const loader = new JsonHttpModelLoader({
        JSON_HTTP_ENDPOINT: 'https://api.example.com/models',
        JSON_HTTP_POLL_INTERVAL: '300',
        JSON_HTTP_TIMEOUT: '10000',
      });
      loaders.push(loader);

      loader.axiosInstance = { get: mockGet };

      const callback = jest.fn();
      loader.watch(callback);

      // First poll - should fire callback
      await jest.advanceTimersByTimeAsync(300 * 1000);

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith({
        'gpt-4': 'https://webhook.example.com/gpt4',
      });

      // Second poll - should fire callback (new model added)
      await jest.advanceTimersByTimeAsync(300 * 1000);

      expect(callback).toHaveBeenCalledTimes(2);
      expect(callback).toHaveBeenLastCalledWith({
        'gpt-4': 'https://webhook.example.com/gpt4',
        'claude-3': 'https://webhook.example.com/claude',
      });
    });
  });

  describe('stopWatching', () => {
    test('should stop active polling', () => {
      const loader = new JsonHttpModelLoader({
        JSON_HTTP_ENDPOINT: 'https://api.example.com/models',
        JSON_HTTP_POLL_INTERVAL: '300',
        JSON_HTTP_TIMEOUT: '10000',
      });
      loaders.push(loader);

      loader.watch(() => {});

      expect(loader.pollingTimer).not.toBeNull();

      loader.stopWatching();

      expect(loader.pollingTimer).toBeNull();
      expect(loader.watchCallback).toBeNull();
      expect(loader.lastHash).toBeNull();
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Stopped polling HTTP endpoint'),
      );
    });

    test('should not throw when called without active polling', () => {
      const loader = new JsonHttpModelLoader({
        JSON_HTTP_ENDPOINT: 'https://api.example.com/models',
        JSON_HTTP_POLL_INTERVAL: '300',
        JSON_HTTP_TIMEOUT: '10000',
      });
      loaders.push(loader);

      expect(() => loader.stopWatching()).not.toThrow();
    });

    test('should be idempotent', () => {
      const loader = new JsonHttpModelLoader({
        JSON_HTTP_ENDPOINT: 'https://api.example.com/models',
        JSON_HTTP_POLL_INTERVAL: '300',
        JSON_HTTP_TIMEOUT: '10000',
      });
      loaders.push(loader);

      loader.watch(() => {});
      loader.stopWatching();
      loader.stopWatching();

      expect(loader.pollingTimer).toBeNull();
    });
  });
});
