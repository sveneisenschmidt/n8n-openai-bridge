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

const { handleMcpNonStreaming } = require('../../src/handlers/mcpNonStreamingHandler');

describe('MCP Non-Streaming Handler', () => {
  let mockRes;
  let mockMcpClient;
  let mockConfig;
  let consoleLogSpy;

  beforeEach(() => {
    mockRes = {
      json: jest.fn(),
    };

    mockMcpClient = {
      executeWorkflow: jest.fn(),
    };

    mockConfig = {
      logRequests: false,
    };

    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  test('should execute workflow and return response', async () => {
    mockMcpClient.executeWorkflow.mockResolvedValue('Hello from MCP');

    await handleMcpNonStreaming(
      mockRes,
      mockMcpClient,
      'workflow-123',
      [{ role: 'user', content: 'Hi' }],
      'session-1',
      {},
      'test-model',
      mockConfig,
    );

    expect(mockMcpClient.executeWorkflow).toHaveBeenCalledWith('workflow-123', 'Hi', 'session-1');
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        object: 'chat.completion',
        model: 'test-model',
        choices: expect.arrayContaining([
          expect.objectContaining({
            message: expect.objectContaining({
              role: 'assistant',
              content: 'Hello from MCP',
            }),
          }),
        ]),
      }),
    );
  });

  test('should extract last user message', async () => {
    mockMcpClient.executeWorkflow.mockResolvedValue('Response');

    const messages = [
      { role: 'system', content: 'You are helpful' },
      { role: 'user', content: 'First message' },
      { role: 'assistant', content: 'First response' },
      { role: 'user', content: 'Second message' },
    ];

    await handleMcpNonStreaming(
      mockRes,
      mockMcpClient,
      'workflow-123',
      messages,
      'session-1',
      {},
      'test-model',
      mockConfig,
    );

    expect(mockMcpClient.executeWorkflow).toHaveBeenCalledWith(
      'workflow-123',
      'Second message',
      'session-1',
    );
  });

  test('should handle empty messages', async () => {
    mockMcpClient.executeWorkflow.mockResolvedValue('Response');

    await handleMcpNonStreaming(
      mockRes,
      mockMcpClient,
      'workflow-123',
      [],
      'session-1',
      {},
      'test-model',
      mockConfig,
    );

    expect(mockMcpClient.executeWorkflow).toHaveBeenCalledWith('workflow-123', '', 'session-1');
  });

  test('should handle messages without user role', async () => {
    mockMcpClient.executeWorkflow.mockResolvedValue('Response');

    const messages = [
      { role: 'system', content: 'You are helpful' },
      { role: 'assistant', content: 'Hello' },
    ];

    await handleMcpNonStreaming(
      mockRes,
      mockMcpClient,
      'workflow-123',
      messages,
      'session-1',
      {},
      'test-model',
      mockConfig,
    );

    expect(mockMcpClient.executeWorkflow).toHaveBeenCalledWith('workflow-123', '', 'session-1');
  });

  test('should log when logRequests is enabled', async () => {
    mockMcpClient.executeWorkflow.mockResolvedValue('Hello');
    mockConfig.logRequests = true;

    await handleMcpNonStreaming(
      mockRes,
      mockMcpClient,
      'workflow-123',
      [{ role: 'user', content: 'Hi' }],
      'session-1',
      {},
      'test-model',
      mockConfig,
    );

    expect(consoleLogSpy).toHaveBeenCalledWith(
      'MCP non-streaming completed for session: session-1',
    );
  });

  test('should not log when logRequests is disabled', async () => {
    mockMcpClient.executeWorkflow.mockResolvedValue('Hello');
    mockConfig.logRequests = false;

    await handleMcpNonStreaming(
      mockRes,
      mockMcpClient,
      'workflow-123',
      [{ role: 'user', content: 'Hi' }],
      'session-1',
      {},
      'test-model',
      mockConfig,
    );

    expect(consoleLogSpy).not.toHaveBeenCalled();
  });
});
