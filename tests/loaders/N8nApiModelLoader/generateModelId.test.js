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

describe('N8nApiModelLoader - generateModelId', () => {
  let loader;
  let consoleLogSpy;

  beforeAll(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
  });

  afterAll(() => {
    consoleLogSpy.mockRestore();
  });

  beforeEach(() => {
    loader = new N8nApiModelLoader({
      N8N_BASE_URL: 'https://n8n.example.com',
      N8N_API_BEARER_TOKEN: 'test-token',
      AUTO_DISCOVERY_TAG: 'n8n-openai-bridge',
      AUTO_DISCOVERY_POLLING: '300',
    });
  });

  test('should use custom model tag as priority', () => {
    const workflow = {
      id: 'workflow-1',
      name: 'Test Workflow',
      tags: [
        { id: 'tag-1', name: 'n8n-openai-bridge' },
        { id: 'tag-2', name: 'model:custom-gpt-4' },
      ],
    };

    const modelId = loader.generateModelId(workflow);
    expect(modelId).toBe('custom-gpt-4');
  });

  test('should use unsanitized workflow name when no custom tag present', () => {
    const workflow = {
      id: 'workflow-1',
      name: 'GPT-4 Agent Workflow',
      tags: [{ id: 'tag-1', name: 'n8n-openai-bridge' }],
    };

    const modelId = loader.generateModelId(workflow);
    expect(modelId).toBe('GPT-4 Agent Workflow');
  });

  test('should preserve special characters in workflow name', () => {
    const workflow = {
      id: 'workflow-1',
      name: 'Claude 3.5 Sonnet - Latest',
      tags: [],
    };

    const modelId = loader.generateModelId(workflow);
    expect(modelId).toBe('Claude 3.5 Sonnet - Latest');
  });

  test('should preserve spaces in workflow name', () => {
    const workflow = {
      id: 'workflow-1',
      name: 'My Test Model',
      tags: [],
    };

    const modelId = loader.generateModelId(workflow);
    expect(modelId).toBe('My Test Model');
  });

  test('should preserve all characters in workflow name', () => {
    const workflow = {
      id: 'workflow-1',
      name: 'Test@Model#123!',
      tags: [],
    };

    const modelId = loader.generateModelId(workflow);
    expect(modelId).toBe('Test@Model#123!');
  });

  test('should trim whitespace from workflow name', () => {
    const workflow = {
      id: 'workflow-1',
      name: '  Test Model  ',
      tags: [],
    };

    const modelId = loader.generateModelId(workflow);
    expect(modelId).toBe('Test Model');
  });

  test('should fallback to workflow ID when name is empty', () => {
    const workflow = {
      id: 'workflow-123',
      name: '',
      tags: [],
    };

    const modelId = loader.generateModelId(workflow);
    expect(modelId).toBe('workflow-123');
  });

  test('should fallback to workflow ID when name is only whitespace', () => {
    const workflow = {
      id: 'workflow-456',
      name: '   ',
      tags: [],
    };

    const modelId = loader.generateModelId(workflow);
    expect(modelId).toBe('workflow-456');
  });

  test('should handle model tag with empty value', () => {
    const workflow = {
      id: 'workflow-1',
      name: 'Test Workflow',
      tags: [{ id: 'tag-1', name: 'model:' }],
    };

    const modelId = loader.generateModelId(workflow);
    expect(modelId).toBe('Test Workflow');
  });

  test('should handle missing tags array', () => {
    const workflow = {
      id: 'workflow-1',
      name: 'Test Workflow',
    };

    const modelId = loader.generateModelId(workflow);
    expect(modelId).toBe('Test Workflow');
  });
});
