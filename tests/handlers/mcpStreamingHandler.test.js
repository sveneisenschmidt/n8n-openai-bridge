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

const { handleMcpStreaming } = require('../../src/handlers/mcpStreamingHandler');

describe('MCP Streaming Handler', () => {
  let mockRes;
  let mockMcpClient;
  let mockConfig;
  let consoleLogSpy;
  let consoleErrorSpy;

  beforeEach(() => {
    mockRes = {
      setHeader: jest.fn(),
      write: jest.fn(),
      end: jest.fn(),
    };

    mockMcpClient = {
      executeWorkflow: jest.fn(),
    };

    mockConfig = {
      logRequests: false,
    };

    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  test('should set SSE headers', async () => {
    mockMcpClient.executeWorkflow.mockResolvedValue('Hello from MCP');

    await handleMcpStreaming(
      mockRes,
      mockMcpClient,
      'workflow-123',
      [{ role: 'user', content: 'Hi' }],
      'session-1',
      {},
      'test-model',
      mockConfig,
    );

    expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'text/event-stream');
    expect(mockRes.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-cache');
    expect(mockRes.setHeader).toHaveBeenCalledWith('Connection', 'keep-alive');
  });

  test('should execute workflow and stream response', async () => {
    mockMcpClient.executeWorkflow.mockResolvedValue('Hello from MCP');

    await handleMcpStreaming(
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

    // Should write content chunk, final chunk, and [DONE]
    expect(mockRes.write).toHaveBeenCalledTimes(3);
    expect(mockRes.end).toHaveBeenCalled();

    // Check content chunk
    const contentCall = mockRes.write.mock.calls[0][0];
    expect(contentCall).toContain('data:');
    expect(contentCall).toContain('Hello from MCP');

    // Check [DONE]
    const doneCall = mockRes.write.mock.calls[2][0];
    expect(doneCall).toBe('data: [DONE]\n\n');
  });

  test('should extract last user message', async () => {
    mockMcpClient.executeWorkflow.mockResolvedValue('Response');

    const messages = [
      { role: 'system', content: 'You are helpful' },
      { role: 'user', content: 'First message' },
      { role: 'assistant', content: 'First response' },
      { role: 'user', content: 'Second message' },
    ];

    await handleMcpStreaming(
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

    await handleMcpStreaming(
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

  test('should handle empty response content', async () => {
    mockMcpClient.executeWorkflow.mockResolvedValue('');

    await handleMcpStreaming(
      mockRes,
      mockMcpClient,
      'workflow-123',
      [{ role: 'user', content: 'Hi' }],
      'session-1',
      {},
      'test-model',
      mockConfig,
    );

    // Should only write final chunk and [DONE] (no content chunk for empty string)
    expect(mockRes.write).toHaveBeenCalledTimes(2);
    expect(mockRes.end).toHaveBeenCalled();
  });

  test('should log when logRequests is enabled', async () => {
    mockMcpClient.executeWorkflow.mockResolvedValue('Hello');
    mockConfig.logRequests = true;

    await handleMcpStreaming(
      mockRes,
      mockMcpClient,
      'workflow-123',
      [{ role: 'user', content: 'Hi' }],
      'session-1',
      {},
      'test-model',
      mockConfig,
    );

    expect(consoleLogSpy).toHaveBeenCalledWith('MCP streaming completed for session: session-1');
  });

  test('should handle errors gracefully', async () => {
    mockMcpClient.executeWorkflow.mockRejectedValue(new Error('Workflow failed'));

    await handleMcpStreaming(
      mockRes,
      mockMcpClient,
      'workflow-123',
      [{ role: 'user', content: 'Hi' }],
      'session-1',
      {},
      'test-model',
      mockConfig,
    );

    expect(consoleErrorSpy).toHaveBeenCalledWith('MCP stream error:', expect.any(Error));

    // Should write error chunk and end
    const errorCall = mockRes.write.mock.calls[0][0];
    expect(errorCall).toContain('data:');
    expect(errorCall).toContain('error');
    expect(mockRes.end).toHaveBeenCalled();
  });
});
