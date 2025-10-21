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

describe('N8nApiModelLoader - extractWebhookUrl', () => {
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

  test('should extract webhook URL from active workflow with chatTrigger', () => {
    const workflow = {
      id: 'workflow-1',
      name: 'Test Workflow',
      active: true,
      nodes: [
        {
          type: '@n8n/n8n-nodes-langchain.chatTrigger',
          webhookId: 'my-webhook-id',
        },
      ],
    };

    const url = loader.extractWebhookUrl(workflow);
    expect(url).toBe('https://n8n.example.com/webhook/my-webhook-id/chat');
  });

  test('should return null when no chatTrigger node found', () => {
    const workflow = {
      id: 'workflow-1',
      name: 'Test Workflow',
      active: true,
      nodes: [
        {
          type: 'n8n-nodes-base.httpRequest',
          parameters: {},
        },
      ],
    };

    const url = loader.extractWebhookUrl(workflow);
    expect(url).toBeNull();
  });

  test('should return null when chatTrigger node has no webhookId', () => {
    const workflow = {
      id: 'workflow-1',
      name: 'Test Workflow',
      active: true,
      nodes: [
        {
          type: '@n8n/n8n-nodes-langchain.chatTrigger',
        },
      ],
    };

    const url = loader.extractWebhookUrl(workflow);
    expect(url).toBeNull();
  });

  test('should return null when webhookId is not a string', () => {
    const workflow = {
      id: 'workflow-1',
      name: 'Test Workflow',
      active: true,
      nodes: [
        {
          type: '@n8n/n8n-nodes-langchain.chatTrigger',
          webhookId: 123,
        },
      ],
    };

    const url = loader.extractWebhookUrl(workflow);
    expect(url).toBeNull();
  });

  test('should return null when workflow is not active', () => {
    const workflow = {
      id: 'workflow-1',
      name: 'Test Workflow',
      active: false,
      nodes: [
        {
          type: '@n8n/n8n-nodes-langchain.chatTrigger',
          webhookId: 'my-webhook-id',
        },
      ],
    };

    const url = loader.extractWebhookUrl(workflow);
    expect(url).toBeNull();
  });

  test('should use first chatTrigger node when multiple exist', () => {
    const workflow = {
      id: 'workflow-1',
      name: 'Test Workflow',
      active: true,
      nodes: [
        {
          type: '@n8n/n8n-nodes-langchain.chatTrigger',
          webhookId: 'first-webhook-id',
        },
        {
          type: '@n8n/n8n-nodes-langchain.chatTrigger',
          webhookId: 'second-webhook-id',
        },
      ],
    };

    const url = loader.extractWebhookUrl(workflow);
    expect(url).toBe('https://n8n.example.com/webhook/first-webhook-id/chat');
  });

  test('should handle missing nodes array', () => {
    const workflow = {
      id: 'workflow-1',
      name: 'Test Workflow',
      active: true,
    };

    const url = loader.extractWebhookUrl(workflow);
    expect(url).toBeNull();
  });
});
