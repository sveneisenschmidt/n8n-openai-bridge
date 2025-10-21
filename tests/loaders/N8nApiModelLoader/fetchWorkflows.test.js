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

describe('N8nApiModelLoader - fetchWorkflows', () => {
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

  test('should fetch workflows from n8n API with correct parameters', async () => {
    const mockWorkflows = [
      {
        id: 'workflow-1',
        name: 'Test Workflow 1',
        active: true,
        tags: [{ id: 'tag-1', name: 'openai-model' }],
        nodes: [],
      },
    ];

    const mockGet = jest.fn().mockResolvedValue({
      data: { data: mockWorkflows },
    });

    const loader = new N8nApiModelLoader({
      N8N_BASE_URL: 'https://n8n.example.com',
      N8N_API_BEARER_TOKEN: 'test-token',
      AUTO_DISCOVERY_TAG: 'openai-model',
      AUTO_DISCOVERY_POLLING: '300',
    });

    loader.axiosInstance = { get: mockGet };

    const workflows = await loader.fetchWorkflows();

    expect(mockGet).toHaveBeenCalledWith('/api/v1/workflows', {
      params: {
        active: true,
        tags: 'openai-model',
      },
    });
    expect(workflows).toEqual(mockWorkflows);
  });

  test('should return empty array when no workflows found', async () => {
    const mockGet = jest.fn().mockResolvedValue({
      data: { data: [] },
    });

    const loader = new N8nApiModelLoader({
      N8N_BASE_URL: 'https://n8n.example.com',
      N8N_API_BEARER_TOKEN: 'test-token',
      AUTO_DISCOVERY_TAG: 'openai-model',
      AUTO_DISCOVERY_POLLING: '300',
    });

    loader.axiosInstance = { get: mockGet };

    const workflows = await loader.fetchWorkflows();

    expect(workflows).toEqual([]);
  });

  test('should handle missing data property in response', async () => {
    const mockGet = jest.fn().mockResolvedValue({
      data: {},
    });

    const loader = new N8nApiModelLoader({
      N8N_BASE_URL: 'https://n8n.example.com',
      N8N_API_BEARER_TOKEN: 'test-token',
      AUTO_DISCOVERY_TAG: 'openai-model',
      AUTO_DISCOVERY_POLLING: '300',
    });

    loader.axiosInstance = { get: mockGet };

    const workflows = await loader.fetchWorkflows();

    expect(workflows).toEqual([]);
  });
});
