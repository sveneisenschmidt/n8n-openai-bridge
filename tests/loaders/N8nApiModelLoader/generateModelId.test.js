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
      AUTO_DISCOVERY_TAG: 'openai-model',
      AUTO_DISCOVERY_POLLING: '300',
    });
  });

  test('should use custom model tag as priority', () => {
    const workflow = {
      id: 'workflow-1',
      name: 'Test Workflow',
      tags: [
        { id: 'tag-1', name: 'openai-model' },
        { id: 'tag-2', name: 'model:custom-gpt-4' },
      ],
    };

    const modelId = loader.generateModelId(workflow);
    expect(modelId).toBe('custom-gpt-4');
  });

  test('should sanitize workflow name when no custom tag present', () => {
    const workflow = {
      id: 'workflow-1',
      name: 'GPT-4 Agent Workflow',
      tags: [{ id: 'tag-1', name: 'openai-model' }],
    };

    const modelId = loader.generateModelId(workflow);
    expect(modelId).toBe('gpt-4-agent-workflow');
  });

  test('should convert spaces to hyphens', () => {
    const workflow = {
      id: 'workflow-1',
      name: 'My Test Model',
      tags: [],
    };

    const modelId = loader.generateModelId(workflow);
    expect(modelId).toBe('my-test-model');
  });

  test('should remove invalid characters', () => {
    const workflow = {
      id: 'workflow-1',
      name: 'Test@Model#123!',
      tags: [],
    };

    const modelId = loader.generateModelId(workflow);
    expect(modelId).toBe('testmodel123');
  });

  test('should preserve hyphens and underscores', () => {
    const workflow = {
      id: 'workflow-1',
      name: 'test-model_v2',
      tags: [],
    };

    const modelId = loader.generateModelId(workflow);
    expect(modelId).toBe('test-model_v2');
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

  test('should fallback to workflow ID when name becomes empty after sanitization', () => {
    const workflow = {
      id: 'workflow-456',
      name: '@#$%^&*()',
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
    expect(modelId).toBe('test-workflow');
  });

  test('should handle missing tags array', () => {
    const workflow = {
      id: 'workflow-1',
      name: 'Test Workflow',
    };

    const modelId = loader.generateModelId(workflow);
    expect(modelId).toBe('test-workflow');
  });
});
