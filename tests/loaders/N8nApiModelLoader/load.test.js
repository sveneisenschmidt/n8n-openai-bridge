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

describe('N8nApiModelLoader - load', () => {
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
    const mockWorkflows = [
      {
        id: 'workflow-1',
        name: 'GPT-4',
        active: true,
        nodes: [
          {
            type: '@n8n/n8n-nodes-langchain.chatTrigger',
            webhookId: 'gpt4-webhook-id',
          },
        ],
      },
    ];

    const mockGet = jest.fn().mockResolvedValue({
      data: { data: mockWorkflows },
    });

    const loader = new N8nApiModelLoader({
      N8N_BASE_URL: 'https://n8n.example.com',
      N8N_API_BEARER_TOKEN: 'test-token',
      AUTO_DISCOVERY_TAG: 'n8n-openai-bridge',
      AUTO_DISCOVERY_POLLING: '300',
    });

    loader.axiosInstance = { get: mockGet };

    const models = await loader.load();

    expect(models).toEqual({
      'gpt-4': 'https://n8n.example.com/webhook/gpt4-webhook-id/chat',
    });
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('Fetched 1 workflows from n8n'),
    );
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Loaded 1 models from n8n'));
  });

  test('should throw descriptive error on 401 Unauthorized', async () => {
    const mockGet = jest.fn().mockRejectedValue({
      response: {
        status: 401,
        data: { message: 'Invalid API token' },
      },
    });

    const loader = new N8nApiModelLoader({
      N8N_BASE_URL: 'https://n8n.example.com',
      N8N_API_BEARER_TOKEN: 'invalid-token',
      AUTO_DISCOVERY_TAG: 'n8n-openai-bridge',
      AUTO_DISCOVERY_POLLING: '300',
    });

    loader.axiosInstance = { get: mockGet };

    await expect(loader.load()).rejects.toThrow('n8n API authentication failed');
  });

  test('should throw descriptive error on 403 Forbidden', async () => {
    const mockGet = jest.fn().mockRejectedValue({
      response: {
        status: 403,
        data: { message: 'Insufficient permissions' },
      },
    });

    const loader = new N8nApiModelLoader({
      N8N_BASE_URL: 'https://n8n.example.com',
      N8N_API_BEARER_TOKEN: 'test-token',
      AUTO_DISCOVERY_TAG: 'n8n-openai-bridge',
      AUTO_DISCOVERY_POLLING: '300',
    });

    loader.axiosInstance = { get: mockGet };

    await expect(loader.load()).rejects.toThrow('n8n API access forbidden');
  });

  test('should throw descriptive error on 404 Not Found', async () => {
    const mockGet = jest.fn().mockRejectedValue({
      response: {
        status: 404,
        data: { message: 'Not found' },
      },
    });

    const loader = new N8nApiModelLoader({
      N8N_BASE_URL: 'https://wrong-url.example.com',
      N8N_API_BEARER_TOKEN: 'test-token',
      AUTO_DISCOVERY_TAG: 'n8n-openai-bridge',
      AUTO_DISCOVERY_POLLING: '300',
    });

    loader.axiosInstance = { get: mockGet };

    await expect(loader.load()).rejects.toThrow('n8n API not found: Check N8N_BASE_URL');
  });

  test('should throw descriptive error on network failure', async () => {
    const mockGet = jest.fn().mockRejectedValue({
      request: {},
      message: 'Network Error',
    });

    const loader = new N8nApiModelLoader({
      N8N_BASE_URL: 'https://n8n.example.com',
      N8N_API_BEARER_TOKEN: 'test-token',
      AUTO_DISCOVERY_TAG: 'n8n-openai-bridge',
      AUTO_DISCOVERY_POLLING: '300',
    });

    loader.axiosInstance = { get: mockGet };

    await expect(loader.load()).rejects.toThrow('Cannot reach n8n API');
  });

  test('should throw error on other HTTP errors', async () => {
    const mockGet = jest.fn().mockRejectedValue({
      response: {
        status: 500,
        data: { message: 'Internal Server Error' },
      },
    });

    const loader = new N8nApiModelLoader({
      N8N_BASE_URL: 'https://n8n.example.com',
      N8N_API_BEARER_TOKEN: 'test-token',
      AUTO_DISCOVERY_TAG: 'n8n-openai-bridge',
      AUTO_DISCOVERY_POLLING: '300',
    });

    loader.axiosInstance = { get: mockGet };

    await expect(loader.load()).rejects.toThrow('n8n API error (500)');
  });
});
