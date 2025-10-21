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

describe('N8nApiModelLoader - workflowsToModels', () => {
  let loader;
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
    loader = new N8nApiModelLoader({
      N8N_BASE_URL: 'https://n8n.example.com',
      N8N_API_BEARER_TOKEN: 'test-token',
      AUTO_DISCOVERY_TAG: 'openai-model',
      AUTO_DISCOVERY_POLLING: '300',
    });
  });

  test('should convert workflows to models object', () => {
    const workflows = [
      {
        id: 'workflow-1',
        name: 'GPT-4',
        active: true,
        nodes: [
          {
            type: 'n8n-nodes-base.webhook',
            parameters: { path: 'gpt4' },
          },
        ],
      },
      {
        id: 'workflow-2',
        name: 'Claude',
        active: true,
        nodes: [
          {
            type: 'n8n-nodes-base.webhook',
            parameters: { path: 'claude' },
          },
        ],
      },
    ];

    const models = loader.workflowsToModels(workflows);

    expect(models).toEqual({
      'gpt-4': 'https://n8n.example.com/webhook/gpt4',
      claude: 'https://n8n.example.com/webhook/claude',
    });
  });

  test('should skip inactive workflows', () => {
    const workflows = [
      {
        id: 'workflow-1',
        name: 'Active Workflow',
        active: true,
        nodes: [
          {
            type: 'n8n-nodes-base.webhook',
            parameters: { path: 'active' },
          },
        ],
      },
      {
        id: 'workflow-2',
        name: 'Inactive Workflow',
        active: false,
        nodes: [
          {
            type: 'n8n-nodes-base.webhook',
            parameters: { path: 'inactive' },
          },
        ],
      },
    ];

    const models = loader.workflowsToModels(workflows);

    expect(models).toEqual({
      'active-workflow': 'https://n8n.example.com/webhook/active',
    });
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Skipping inactive workflow'),
    );
  });

  test('should skip workflows without webhook nodes', () => {
    const workflows = [
      {
        id: 'workflow-1',
        name: 'Valid Workflow',
        active: true,
        nodes: [
          {
            type: 'n8n-nodes-base.webhook',
            parameters: { path: 'valid' },
          },
        ],
      },
      {
        id: 'workflow-2',
        name: 'Invalid Workflow',
        active: true,
        nodes: [
          {
            type: 'n8n-nodes-base.httpRequest',
            parameters: {},
          },
        ],
      },
    ];

    const models = loader.workflowsToModels(workflows);

    expect(models).toEqual({
      'valid-workflow': 'https://n8n.example.com/webhook/valid',
    });
    expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('No webhook node found'));
  });

  test('should handle duplicate model IDs', () => {
    const workflows = [
      {
        id: 'workflow-1',
        name: 'Test Model',
        active: true,
        nodes: [
          {
            type: 'n8n-nodes-base.webhook',
            parameters: { path: 'test1' },
          },
        ],
      },
      {
        id: 'workflow-2',
        name: 'Test Model',
        active: true,
        nodes: [
          {
            type: 'n8n-nodes-base.webhook',
            parameters: { path: 'test2' },
          },
        ],
      },
    ];

    const models = loader.workflowsToModels(workflows);

    // Only first one should be included
    expect(models).toEqual({
      'test-model': 'https://n8n.example.com/webhook/test1',
    });
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Duplicate model ID "test-model"'),
    );
  });

  test('should return empty object for empty workflows array', () => {
    const models = loader.workflowsToModels([]);
    expect(models).toEqual({});
  });
});
