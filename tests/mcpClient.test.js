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

const axios = require('axios');
const McpClient = require('../src/mcpClient');

jest.mock('axios');

describe('McpClient', () => {
  let client;

  beforeEach(() => {
    jest.clearAllMocks();
    client = new McpClient('http://n8n:5678/mcp-server/http', 'test-token');
  });

  describe('constructor', () => {
    test('should initialize with endpoint and token', () => {
      expect(client.endpoint).toBe('http://n8n:5678/mcp-server/http');
      expect(client.bearerToken).toBe('test-token');
      expect(client.timeout).toBe(30000);
    });

    test('should accept custom timeout', () => {
      const customClient = new McpClient('http://n8n:5678/mcp-server/http', 'token', 60000);
      expect(customClient.timeout).toBe(60000);
    });
  });

  describe('getHeaders', () => {
    test('should return correct headers', () => {
      const headers = client.getHeaders();
      expect(headers).toEqual({
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        Authorization: 'Bearer test-token',
      });
    });
  });

  describe('parseSSEResponse', () => {
    test('should parse valid SSE response', () => {
      const sseData = 'event: message\ndata: {"result":{"foo":"bar"},"jsonrpc":"2.0","id":1}';
      const result = client.parseSSEResponse(sseData);
      expect(result).toEqual({ foo: 'bar' });
    });

    test('should throw on missing data line', () => {
      const sseData = 'event: message\n';
      expect(() => client.parseSSEResponse(sseData)).toThrow('No data found in SSE response');
    });

    test('should throw on JSON-RPC error', () => {
      const sseData =
        'data: {"error":{"code":-32000,"message":"Test error"},"jsonrpc":"2.0","id":1}';
      expect(() => client.parseSSEResponse(sseData)).toThrow('MCP error (-32000): Test error');
    });

    test('should throw on invalid JSON', () => {
      const sseData = 'data: {invalid json}';
      expect(() => client.parseSSEResponse(sseData)).toThrow('Failed to parse JSON');
    });
  });

  describe('initialize', () => {
    test('should send initialize request', async () => {
      const mockResponse = {
        data: 'event: message\ndata: {"result":{"protocolVersion":"2024-11-05","serverInfo":{"name":"n8n MCP Server"}},"jsonrpc":"2.0","id":1}',
      };
      axios.post.mockResolvedValue(mockResponse);

      const result = await client.initialize();

      expect(axios.post).toHaveBeenCalledWith(
        'http://n8n:5678/mcp-server/http',
        expect.objectContaining({
          method: 'initialize',
          params: expect.objectContaining({
            protocolVersion: '2024-11-05',
            clientInfo: { name: 'n8n-openai-bridge', version: '1.0.0' },
          }),
        }),
        expect.any(Object),
      );
      expect(result).toEqual({
        protocolVersion: '2024-11-05',
        serverInfo: { name: 'n8n MCP Server' },
      });
    });
  });

  describe('searchWorkflows', () => {
    test('should return workflows from structuredContent', async () => {
      const mockResponse = {
        data: 'event: message\ndata: {"result":{"structuredContent":{"data":[{"id":"wf1","name":"Agent"}],"count":1}},"jsonrpc":"2.0","id":1}',
      };
      axios.post.mockResolvedValue(mockResponse);

      const workflows = await client.searchWorkflows();

      expect(workflows).toEqual([{ id: 'wf1', name: 'Agent' }]);
    });

    test('should pass query options', async () => {
      const mockResponse = {
        data: 'event: message\ndata: {"result":{"structuredContent":{"data":[],"count":0}},"jsonrpc":"2.0","id":1}',
      };
      axios.post.mockResolvedValue(mockResponse);

      await client.searchWorkflows({ query: 'test', limit: 10 });

      expect(axios.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          params: {
            name: 'search_workflows',
            arguments: { query: 'test', limit: 10 },
          },
        }),
        expect.any(Object),
      );
    });

    test('should return empty array when no workflows', async () => {
      const mockResponse = {
        data: 'event: message\ndata: {"result":{"structuredContent":{"data":[],"count":0}},"jsonrpc":"2.0","id":1}',
      };
      axios.post.mockResolvedValue(mockResponse);

      const workflows = await client.searchWorkflows();

      expect(workflows).toEqual([]);
    });
  });

  describe('executeWorkflow', () => {
    test('should execute workflow and extract response', async () => {
      const mockResponse = {
        data: `event: message
data: {"result":{"structuredContent":{"success":true,"executionId":"1","result":{"lastNodeExecuted":"Respond","runData":{"Respond":[{"data":{"main":[[{"sendMessage":"Hello!"}]]}}]}}}},"jsonrpc":"2.0","id":1}`,
      };
      axios.post.mockResolvedValue(mockResponse);

      const result = await client.executeWorkflow('wf-123', 'Hello', 'session-1');

      expect(axios.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          params: {
            name: 'execute_workflow',
            arguments: {
              workflowId: 'wf-123',
              inputs: { type: 'chat', chatInput: 'Hello' },
            },
          },
        }),
        expect.any(Object),
      );
      expect(result).toBe('Hello!');
    });

    test('should throw on workflow execution failure', async () => {
      const mockResponse = {
        data: 'event: message\ndata: {"result":{"structuredContent":{"success":false,"error":"Workflow failed"}},"jsonrpc":"2.0","id":1}',
      };
      axios.post.mockResolvedValue(mockResponse);

      await expect(client.executeWorkflow('wf-123', 'Hello', 'session-1')).rejects.toThrow(
        'MCP workflow error: Workflow failed',
      );
    });
  });

  describe('error handling', () => {
    test('should handle 401 authentication error', async () => {
      axios.post.mockRejectedValue({
        response: { status: 401 },
      });

      await expect(client.searchWorkflows()).rejects.toThrow('MCP authentication failed');
    });

    test('should handle 403 forbidden error', async () => {
      axios.post.mockRejectedValue({
        response: { status: 403 },
      });

      await expect(client.searchWorkflows()).rejects.toThrow('MCP access forbidden');
    });

    test('should handle 404 not found error', async () => {
      axios.post.mockRejectedValue({
        response: { status: 404 },
      });

      await expect(client.searchWorkflows()).rejects.toThrow('MCP endpoint not found');
    });

    test('should handle other HTTP errors', async () => {
      axios.post.mockRejectedValue({
        response: { status: 500 },
        message: 'Internal Server Error',
      });

      await expect(client.searchWorkflows()).rejects.toThrow('MCP request failed (500)');
    });

    test('should handle network errors', async () => {
      axios.post.mockRejectedValue(new Error('ECONNREFUSED'));

      await expect(client.searchWorkflows()).rejects.toThrow('MCP connection error');
    });
  });

  describe('searchWorkflows - fallback parsing', () => {
    test('should parse content array fallback', async () => {
      const mockResponse = {
        data: 'event: message\ndata: {"result":{"content":[{"type":"text","text":"{\\"data\\":[{\\"id\\":\\"wf1\\",\\"name\\":\\"Agent\\"}]}"}]},"jsonrpc":"2.0","id":1}',
      };
      axios.post.mockResolvedValue(mockResponse);

      const workflows = await client.searchWorkflows();

      expect(workflows).toEqual([{ id: 'wf1', name: 'Agent' }]);
    });

    test('should return empty array when content has no text type', async () => {
      const mockResponse = {
        data: 'event: message\ndata: {"result":{"content":[{"type":"image","url":"http://example.com"}]},"jsonrpc":"2.0","id":1}',
      };
      axios.post.mockResolvedValue(mockResponse);

      const workflows = await client.searchWorkflows();

      expect(workflows).toEqual([]);
    });
  });

  describe('getWorkflowDetails', () => {
    test('should return workflow details from structuredContent', async () => {
      const mockResponse = {
        data: 'event: message\ndata: {"result":{"structuredContent":{"id":"wf1","name":"Agent","nodes":[]}},"jsonrpc":"2.0","id":1}',
      };
      axios.post.mockResolvedValue(mockResponse);

      const details = await client.getWorkflowDetails('wf1');

      expect(details).toEqual({ id: 'wf1', name: 'Agent', nodes: [] });
    });

    test('should parse content array fallback', async () => {
      const mockResponse = {
        data: 'event: message\ndata: {"result":{"content":[{"type":"text","text":"{\\"id\\":\\"wf1\\",\\"name\\":\\"Agent\\"}"}]},"jsonrpc":"2.0","id":1}',
      };
      axios.post.mockResolvedValue(mockResponse);

      const details = await client.getWorkflowDetails('wf1');

      expect(details).toEqual({ id: 'wf1', name: 'Agent' });
    });

    test('should return raw result when no structuredContent or content', async () => {
      const mockResponse = {
        data: 'event: message\ndata: {"result":{"id":"wf1"},"jsonrpc":"2.0","id":1}',
      };
      axios.post.mockResolvedValue(mockResponse);

      const details = await client.getWorkflowDetails('wf1');

      expect(details).toEqual({ id: 'wf1' });
    });
  });

  describe('extractWorkflowResponse', () => {
    test('should extract sendMessage from last node', async () => {
      const mockResponse = {
        data: `event: message
data: {"result":{"structuredContent":{"success":true,"result":{"lastNodeExecuted":"Chat","runData":{"Chat":[{"data":{"main":[[{"sendMessage":"Hello!"}]]}}]}}}},"jsonrpc":"2.0","id":1}`,
      };
      axios.post.mockResolvedValue(mockResponse);

      const result = await client.executeWorkflow('wf-123', 'Hi', 'session-1');
      expect(result).toBe('Hello!');
    });

    test('should extract text field', async () => {
      const mockResponse = {
        data: `event: message
data: {"result":{"structuredContent":{"success":true,"result":{"lastNodeExecuted":"Node","runData":{"Node":[{"data":{"main":[[{"text":"Hello text"}]]}}]}}}},"jsonrpc":"2.0","id":1}`,
      };
      axios.post.mockResolvedValue(mockResponse);

      const result = await client.executeWorkflow('wf-123', 'Hi', 'session-1');
      expect(result).toBe('Hello text');
    });

    test('should extract content field', async () => {
      const mockResponse = {
        data: `event: message
data: {"result":{"structuredContent":{"success":true,"result":{"lastNodeExecuted":"Node","runData":{"Node":[{"data":{"main":[[{"content":"Hello content"}]]}}]}}}},"jsonrpc":"2.0","id":1}`,
      };
      axios.post.mockResolvedValue(mockResponse);

      const result = await client.executeWorkflow('wf-123', 'Hi', 'session-1');
      expect(result).toBe('Hello content');
    });

    test('should extract output field', async () => {
      const mockResponse = {
        data: `event: message
data: {"result":{"structuredContent":{"success":true,"result":{"lastNodeExecuted":"Node","runData":{"Node":[{"data":{"main":[[{"output":"Hello output"}]]}}]}}}},"jsonrpc":"2.0","id":1}`,
      };
      axios.post.mockResolvedValue(mockResponse);

      const result = await client.executeWorkflow('wf-123', 'Hi', 'session-1');
      expect(result).toBe('Hello output');
    });

    test('should extract json.content field', async () => {
      const mockResponse = {
        data: `event: message
data: {"result":{"structuredContent":{"success":true,"result":{"lastNodeExecuted":"Node","runData":{"Node":[{"data":{"main":[[{"json":{"content":"Hello json content"}}]]}}]}}}},"jsonrpc":"2.0","id":1}`,
      };
      axios.post.mockResolvedValue(mockResponse);

      const result = await client.executeWorkflow('wf-123', 'Hi', 'session-1');
      expect(result).toBe('Hello json content');
    });

    test('should extract json.text field', async () => {
      const mockResponse = {
        data: `event: message
data: {"result":{"structuredContent":{"success":true,"result":{"lastNodeExecuted":"Node","runData":{"Node":[{"data":{"main":[[{"json":{"text":"Hello json text"}}]]}}]}}}},"jsonrpc":"2.0","id":1}`,
      };
      axios.post.mockResolvedValue(mockResponse);

      const result = await client.executeWorkflow('wf-123', 'Hi', 'session-1');
      expect(result).toBe('Hello json text');
    });

    test('should stringify json when no known fields', async () => {
      const mockResponse = {
        data: `event: message
data: {"result":{"structuredContent":{"success":true,"result":{"lastNodeExecuted":"Node","runData":{"Node":[{"data":{"main":[[{"json":{"custom":"value"}}]]}}]}}}},"jsonrpc":"2.0","id":1}`,
      };
      axios.post.mockResolvedValue(mockResponse);

      const result = await client.executeWorkflow('wf-123', 'Hi', 'session-1');
      expect(result).toBe('{"custom":"value"}');
    });

    test('should fallback to find sendMessage in any node when last node has no output', async () => {
      // When lastNodeExecuted has no data.main[0][0], it should check other nodes
      const mockResponse = {
        data: `event: message
data: {"result":{"structuredContent":{"success":true,"result":{"lastNodeExecuted":"OtherNode","runData":{"OtherNode":[{"data":{"main":[]}}],"ChatNode":[{"data":{"main":[[{"sendMessage":"Found it!"}]]}}]}}}},"jsonrpc":"2.0","id":1}`,
      };
      axios.post.mockResolvedValue(mockResponse);

      const result = await client.executeWorkflow('wf-123', 'Hi', 'session-1');
      expect(result).toBe('Found it!');
    });

    test('should throw when no runData', async () => {
      const mockResponse = {
        data: 'event: message\ndata: {"result":{"structuredContent":{"success":true,"result":{}}},"jsonrpc":"2.0","id":1}',
      };
      axios.post.mockResolvedValue(mockResponse);

      await expect(client.executeWorkflow('wf-123', 'Hi', 'session-1')).rejects.toThrow(
        'No runData in response',
      );
    });

    test('should throw when cannot extract response', async () => {
      const mockResponse = {
        data: `event: message
data: {"result":{"structuredContent":{"success":true,"result":{"lastNodeExecuted":"Node","runData":{"Node":[{"data":{"main":[[]]}}]}}}},"jsonrpc":"2.0","id":1}`,
      };
      axios.post.mockResolvedValue(mockResponse);

      await expect(client.executeWorkflow('wf-123', 'Hi', 'session-1')).rejects.toThrow(
        'Could not extract response from workflow',
      );
    });
  });
});
