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

describe('N8nApiModelLoader - Polling', () => {
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
          data: [
            {
              id: 'workflow-1',
              name: 'Test',
              active: true,
              nodes: [
                {
                  type: '@n8n/n8n-nodes-langchain.chatTrigger',
                  webhookId: 'test-webhook-id',
                },
              ],
            },
          ],
        },
      });

      const loader = new N8nApiModelLoader({
        N8N_BASE_URL: 'https://n8n.example.com',
        N8N_API_BEARER_TOKEN: 'test-token',
        AUTO_DISCOVERY_TAG: 'n8n-openai-bridge',
        AUTO_DISCOVERY_POLL_INTERVAL: '300',
      });
      loaders.push(loader);

      loader.axiosInstance = { get: mockGet };

      const callback = jest.fn();
      loader.watch(callback);

      expect(loader.pollingTimer).not.toBeNull();
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Starting polling every 300s'),
      );

      // Trigger polling and run all timers
      await jest.advanceTimersByTimeAsync(300 * 1000);

      expect(mockGet).toHaveBeenCalled();
      expect(callback).toHaveBeenCalledWith({
        Test: 'https://n8n.example.com/webhook/test-webhook-id/chat',
      });
    });

    test('should not start polling when interval is 0', () => {
      const loader = new N8nApiModelLoader({
        N8N_BASE_URL: 'https://n8n.example.com',
        N8N_API_BEARER_TOKEN: 'test-token',
        AUTO_DISCOVERY_TAG: 'n8n-openai-bridge',
        AUTO_DISCOVERY_POLL_INTERVAL: '0',
      });
      loaders.push(loader);

      const callback = jest.fn();
      loader.watch(callback);

      expect(loader.pollingTimer).toBeNull();
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Polling disabled'));
    });

    test('should not watch twice', () => {
      const loader = new N8nApiModelLoader({
        N8N_BASE_URL: 'https://n8n.example.com',
        N8N_API_BEARER_TOKEN: 'test-token',
        AUTO_DISCOVERY_TAG: 'n8n-openai-bridge',
        AUTO_DISCOVERY_POLL_INTERVAL: '300',
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
            data: [
              {
                id: 'workflow-1',
                name: 'Test',
                active: true,
                nodes: [
                  {
                    type: '@n8n/n8n-nodes-langchain.chatTrigger',
                    webhookId: 'test-webhook-id',
                  },
                ],
              },
            ],
          },
        });
      });

      const loader = new N8nApiModelLoader({
        N8N_BASE_URL: 'https://n8n.example.com',
        N8N_API_BEARER_TOKEN: 'test-token',
        AUTO_DISCOVERY_TAG: 'n8n-openai-bridge',
        AUTO_DISCOVERY_POLL_INTERVAL: '300',
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
        Test: 'https://n8n.example.com/webhook/test-webhook-id/chat',
      });
    });

    test('should only fire callback when models change', async () => {
      const mockGet = jest.fn().mockResolvedValue({
        data: {
          data: [
            {
              id: 'workflow-1',
              name: 'Test',
              active: true,
              nodes: [
                {
                  type: '@n8n/n8n-nodes-langchain.chatTrigger',
                  webhookId: 'test-webhook-id',
                },
              ],
            },
          ],
        },
      });

      const loader = new N8nApiModelLoader({
        N8N_BASE_URL: 'https://n8n.example.com',
        N8N_API_BEARER_TOKEN: 'test-token',
        AUTO_DISCOVERY_TAG: 'n8n-openai-bridge',
        AUTO_DISCOVERY_POLL_INTERVAL: '300',
      });
      loaders.push(loader);

      loader.axiosInstance = { get: mockGet };

      const callback = jest.fn();
      loader.watch(callback);

      // First poll - should fire callback (models changed from null to data)
      await jest.advanceTimersByTimeAsync(300 * 1000);

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith({
        Test: 'https://n8n.example.com/webhook/test-webhook-id/chat',
      });

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
              data: [
                {
                  id: 'workflow-1',
                  name: 'Test',
                  active: true,
                  nodes: [
                    {
                      type: '@n8n/n8n-nodes-langchain.chatTrigger',
                      webhookId: 'test-webhook-id',
                    },
                  ],
                },
              ],
            },
          });
        }
        return Promise.resolve({
          data: {
            data: [
              {
                id: 'workflow-1',
                name: 'Test',
                active: true,
                nodes: [
                  {
                    type: '@n8n/n8n-nodes-langchain.chatTrigger',
                    webhookId: 'test-webhook-id',
                  },
                ],
              },
              {
                id: 'workflow-2',
                name: 'Test2',
                active: true,
                nodes: [
                  {
                    type: '@n8n/n8n-nodes-langchain.chatTrigger',
                    webhookId: 'test-webhook-id-2',
                  },
                ],
              },
            ],
          },
        });
      });

      const loader = new N8nApiModelLoader({
        N8N_BASE_URL: 'https://n8n.example.com',
        N8N_API_BEARER_TOKEN: 'test-token',
        AUTO_DISCOVERY_TAG: 'n8n-openai-bridge',
        AUTO_DISCOVERY_POLL_INTERVAL: '300',
      });
      loaders.push(loader);

      loader.axiosInstance = { get: mockGet };

      const callback = jest.fn();
      loader.watch(callback);

      // First poll - should fire callback
      await jest.advanceTimersByTimeAsync(300 * 1000);

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith({
        Test: 'https://n8n.example.com/webhook/test-webhook-id/chat',
      });

      // Second poll - should fire callback (new workflow added)
      await jest.advanceTimersByTimeAsync(300 * 1000);

      expect(callback).toHaveBeenCalledTimes(2);
      expect(callback).toHaveBeenLastCalledWith({
        Test: 'https://n8n.example.com/webhook/test-webhook-id/chat',
        Test2: 'https://n8n.example.com/webhook/test-webhook-id-2/chat',
      });
    });
  });

  describe('stopWatching', () => {
    test('should stop active polling', () => {
      const loader = new N8nApiModelLoader({
        N8N_BASE_URL: 'https://n8n.example.com',
        N8N_API_BEARER_TOKEN: 'test-token',
        AUTO_DISCOVERY_TAG: 'n8n-openai-bridge',
        AUTO_DISCOVERY_POLL_INTERVAL: '300',
      });
      loaders.push(loader);

      loader.watch(() => {});

      expect(loader.pollingTimer).not.toBeNull();

      loader.stopWatching();

      expect(loader.pollingTimer).toBeNull();
      expect(loader.watchCallback).toBeNull();
      expect(loader.lastHash).toBeNull();
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Stopped polling n8n API'),
      );
    });

    test('should not throw when called without active polling', () => {
      const loader = new N8nApiModelLoader({
        N8N_BASE_URL: 'https://n8n.example.com',
        N8N_API_BEARER_TOKEN: 'test-token',
        AUTO_DISCOVERY_TAG: 'n8n-openai-bridge',
        AUTO_DISCOVERY_POLL_INTERVAL: '300',
      });
      loaders.push(loader);

      expect(() => loader.stopWatching()).not.toThrow();
    });

    test('should be idempotent', () => {
      const loader = new N8nApiModelLoader({
        N8N_BASE_URL: 'https://n8n.example.com',
        N8N_API_BEARER_TOKEN: 'test-token',
        AUTO_DISCOVERY_TAG: 'n8n-openai-bridge',
        AUTO_DISCOVERY_POLL_INTERVAL: '300',
      });
      loaders.push(loader);

      loader.watch(() => {});
      loader.stopWatching();
      loader.stopWatching();

      expect(loader.pollingTimer).toBeNull();
    });
  });
});
