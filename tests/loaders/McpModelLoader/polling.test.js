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

describe('McpModelLoader - Polling', () => {
  let consoleLogSpy;
  let consoleWarnSpy;
  let consoleErrorSpy;
  let mockSearchWorkflows;

  beforeAll(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    jest.useFakeTimers();
  });

  afterAll(() => {
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    jest.useRealTimers();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();

    // Setup mock for searchWorkflows before each test
    mockSearchWorkflows = jest.fn().mockResolvedValue([]);
    McpClient.mockImplementation(() => ({
      searchWorkflows: mockSearchWorkflows,
    }));
  });

  function createLoader(pollInterval = '60') {
    return new McpModelLoader({
      N8N_MCP_ENDPOINT: 'http://n8n:5678/mcp-server/http',
      N8N_MCP_BEARER_TOKEN: 'test-token',
      MCP_POLL_INTERVAL: pollInterval,
    });
  }

  test('should not start polling when interval is 0', () => {
    const loader = createLoader('0');
    const callback = jest.fn();

    loader.watch(callback);

    expect(loader.pollingTimer).toBeNull();
    expect(consoleLogSpy).toHaveBeenCalledWith('Polling disabled (MCP_POLL_INTERVAL=0)');
  });

  test('should start polling at configured interval', () => {
    const loader = createLoader('60');
    const callback = jest.fn();

    loader.watch(callback);

    expect(loader.pollingTimer).not.toBeNull();
    expect(consoleLogSpy).toHaveBeenCalledWith('Starting MCP polling every 60s');
  });

  test('should call callback when models change', async () => {
    const mockWorkflows = [{ id: 'workflow-1', name: 'Agent', active: true }];
    mockSearchWorkflows.mockResolvedValue(mockWorkflows);

    const loader = createLoader('60');
    const callback = jest.fn();

    loader.watch(callback);

    // Advance timer to trigger polling
    await jest.advanceTimersByTimeAsync(60000);

    expect(callback).toHaveBeenCalledWith({
      Agent: { type: 'mcp', workflowId: 'workflow-1' },
    });
  });

  test('should not call callback when models have not changed', async () => {
    const mockWorkflows = [{ id: 'workflow-1', name: 'Agent', active: true }];
    mockSearchWorkflows.mockResolvedValue(mockWorkflows);

    const loader = createLoader('60');
    const callback = jest.fn();

    // Set initial hash
    loader.lastHash = loader.getModelsHash({
      Agent: { type: 'mcp', workflowId: 'workflow-1' },
    });

    loader.watch(callback);

    // Advance timer
    await jest.advanceTimersByTimeAsync(60000);

    expect(callback).not.toHaveBeenCalled();
  });

  test('should handle polling errors gracefully', async () => {
    mockSearchWorkflows.mockRejectedValue(new Error('Network error'));

    const loader = createLoader('60');
    const callback = jest.fn();

    loader.watch(callback);

    // Advance timer
    await jest.advanceTimersByTimeAsync(60000);

    expect(callback).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'MCP polling error: MCP model discovery failed: Network error',
    );
  });

  test('should stop polling when stopWatching is called', () => {
    const loader = createLoader('60');
    const callback = jest.fn();

    loader.watch(callback);
    expect(loader.pollingTimer).not.toBeNull();

    loader.stopWatching();

    expect(loader.pollingTimer).toBeNull();
    expect(loader.watchCallback).toBeNull();
    expect(loader.lastHash).toBeNull();
    expect(consoleLogSpy).toHaveBeenCalledWith('Stopped polling MCP server');
  });

  test('should warn if watch is called twice', () => {
    const loader = createLoader('60');
    const callback = jest.fn();

    loader.watch(callback);
    loader.watch(callback);

    expect(consoleWarnSpy).toHaveBeenCalledWith('Polling already active');
  });

  test('should be safe to call stopWatching multiple times', () => {
    const loader = createLoader('60');

    loader.watch(jest.fn());
    loader.stopWatching();
    loader.stopWatching(); // Should not throw

    expect(loader.pollingTimer).toBeNull();
  });
});
