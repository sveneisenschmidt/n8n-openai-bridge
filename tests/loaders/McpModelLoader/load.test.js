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

const McpModelLoader = require('../../../src/loaders/McpModelLoader');
const McpClient = require('../../../src/mcpClient');

jest.mock('../../../src/mcpClient');

describe('McpModelLoader - Load', () => {
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

  function createLoader() {
    return new McpModelLoader({
      N8N_MCP_ENDPOINT: 'http://n8n:5678/mcp-server/http',
      N8N_MCP_BEARER_TOKEN: 'test-token',
      MCP_POLL_INTERVAL: '300',
    });
  }

  test('should load models from MCP server', async () => {
    const mockWorkflows = [
      { id: 'workflow-1', name: 'Test Agent', active: true },
      { id: 'workflow-2', name: 'Another Agent', active: true },
    ];

    McpClient.prototype.searchWorkflows = jest.fn().mockResolvedValue(mockWorkflows);

    const loader = createLoader();
    const models = await loader.load();

    expect(models).toEqual({
      'Test Agent': { type: 'mcp', workflowId: 'workflow-1' },
      'Another Agent': { type: 'mcp', workflowId: 'workflow-2' },
    });
  });

  test('should skip inactive workflows', async () => {
    const mockWorkflows = [
      { id: 'workflow-1', name: 'Active Agent', active: true },
      { id: 'workflow-2', name: 'Inactive Agent', active: false },
    ];

    McpClient.prototype.searchWorkflows = jest.fn().mockResolvedValue(mockWorkflows);

    const loader = createLoader();
    const models = await loader.load();

    expect(models).toEqual({
      'Active Agent': { type: 'mcp', workflowId: 'workflow-1' },
    });
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Skipping inactive workflow'),
    );
  });

  test('should use workflow ID as fallback when name is empty', async () => {
    const mockWorkflows = [
      { id: 'workflow-1', name: '', active: true },
      { id: 'workflow-2', name: null, active: true },
    ];

    McpClient.prototype.searchWorkflows = jest.fn().mockResolvedValue(mockWorkflows);

    const loader = createLoader();
    const models = await loader.load();

    expect(models).toEqual({
      'workflow-1': { type: 'mcp', workflowId: 'workflow-1' },
      'workflow-2': { type: 'mcp', workflowId: 'workflow-2' },
    });
  });

  test('should handle duplicate model IDs', async () => {
    const mockWorkflows = [
      { id: 'workflow-1', name: 'Duplicate Name', active: true },
      { id: 'workflow-2', name: 'Duplicate Name', active: true },
    ];

    McpClient.prototype.searchWorkflows = jest.fn().mockResolvedValue(mockWorkflows);

    const loader = createLoader();
    const models = await loader.load();

    // First one wins
    expect(models).toEqual({
      'Duplicate Name': { type: 'mcp', workflowId: 'workflow-1' },
    });
    expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('Duplicate model ID'));
  });

  test('should handle empty workflow list', async () => {
    McpClient.prototype.searchWorkflows = jest.fn().mockResolvedValue([]);

    const loader = createLoader();
    const models = await loader.load();

    expect(models).toEqual({});
  });

  test('should throw error on MCP failure', async () => {
    McpClient.prototype.searchWorkflows = jest
      .fn()
      .mockRejectedValue(new Error('Connection failed'));

    const loader = createLoader();

    await expect(loader.load()).rejects.toThrow('MCP model discovery failed: Connection failed');
  });

  test('should trim workflow names', async () => {
    const mockWorkflows = [{ id: 'workflow-1', name: '  Padded Name  ', active: true }];

    McpClient.prototype.searchWorkflows = jest.fn().mockResolvedValue(mockWorkflows);

    const loader = createLoader();
    const models = await loader.load();

    expect(models).toEqual({
      'Padded Name': { type: 'mcp', workflowId: 'workflow-1' },
    });
  });
});
