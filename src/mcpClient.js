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

/**
 * McpClient - MCP Protocol Client for n8n Instance-Level MCP Server
 *
 * Handles communication with n8n's MCP server using Streamable HTTP transport.
 * Used for:
 * - Discovery: search_workflows to find MCP-enabled workflows
 * - Execution: execute_workflow to run workflows via MCP
 *
 * Protocol: JSON-RPC 2.0 over Streamable HTTP (SSE responses)
 */
class McpClient {
  /**
   * Create McpClient instance
   * @param {string} endpoint - MCP server endpoint URL
   * @param {string} bearerToken - Bearer token for authentication
   * @param {number} [timeout=30000] - Request timeout in milliseconds
   */
  constructor(endpoint, bearerToken, timeout = 30000) {
    this.endpoint = endpoint;
    this.bearerToken = bearerToken;
    this.timeout = timeout;
    this.requestId = 0;
  }

  /**
   * Get next JSON-RPC request ID
   * @returns {number} Unique request ID
   * @private
   */
  getNextRequestId() {
    return ++this.requestId;
  }

  /**
   * Get headers for MCP requests
   * @returns {Object} HTTP headers
   * @private
   */
  getHeaders() {
    return {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      Authorization: `Bearer ${this.bearerToken}`,
    };
  }

  /**
   * Send JSON-RPC request to MCP server
   * @param {string} method - JSON-RPC method name
   * @param {Object} params - Method parameters
   * @returns {Promise<Object>} Parsed response result
   * @throws {Error} If request fails or returns error
   * @private
   */
  async sendRequest(method, params = {}) {
    const requestBody = {
      jsonrpc: '2.0',
      id: this.getNextRequestId(),
      method,
      params,
    };

    try {
      const response = await axios.post(this.endpoint, requestBody, {
        headers: this.getHeaders(),
        timeout: this.timeout,
        // Response is SSE, read as text
        responseType: 'text',
      });

      return this.parseSSEResponse(response.data);
    } catch (error) {
      if (error.response) {
        const status = error.response.status;
        if (status === 401) {
          throw new Error('MCP authentication failed: Invalid bearer token');
        } else if (status === 403) {
          throw new Error(`MCP access forbidden: ${this.endpoint}`);
        } else if (status === 404) {
          throw new Error(`MCP endpoint not found: ${this.endpoint}`);
        } else {
          throw new Error(`MCP request failed (${status}): ${error.message}`);
        }
      }
      throw new Error(`MCP connection error: ${error.message}`);
    }
  }

  /**
   * Parse SSE response from MCP server
   * @param {string} data - Raw SSE response data
   * @returns {Object} Parsed JSON-RPC result
   * @throws {Error} If response contains error or is invalid
   * @private
   */
  parseSSEResponse(data) {
    // SSE format: "event: message\ndata: {...json...}"
    const lines = data.split('\n');
    let jsonData = null;

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        jsonData = line.substring(6);
        break;
      }
    }

    if (!jsonData) {
      throw new Error('Invalid MCP response: No data found in SSE response');
    }

    try {
      const parsed = JSON.parse(jsonData);

      // Check for JSON-RPC error
      if (parsed.error) {
        throw new Error(`MCP error (${parsed.error.code}): ${parsed.error.message}`);
      }

      return parsed.result;
    } catch (error) {
      if (error.message.startsWith('MCP error')) {
        throw error;
      }
      throw new Error(`Invalid MCP response: Failed to parse JSON - ${error.message}`);
    }
  }

  /**
   * Initialize MCP connection (handshake)
   * @returns {Promise<Object>} Server capabilities
   */
  async initialize() {
    const result = await this.sendRequest('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: {
        name: 'n8n-openai-bridge',
        version: '1.0.0',
      },
    });

    return result;
  }

  /**
   * Search for MCP-enabled workflows
   * @param {Object} [options] - Search options
   * @param {string} [options.query] - Filter by name or description
   * @param {number} [options.limit] - Max results (1-200)
   * @returns {Promise<Array>} Array of workflow objects
   */
  async searchWorkflows(options = {}) {
    const result = await this.sendRequest('tools/call', {
      name: 'search_workflows',
      arguments: options,
    });

    // Response contains structuredContent.data array
    if (result.structuredContent && Array.isArray(result.structuredContent.data)) {
      return result.structuredContent.data;
    }

    // Fallback: try content array
    if (result.content && Array.isArray(result.content)) {
      const textContent = result.content.find((c) => c.type === 'text');
      if (textContent) {
        const parsed = JSON.parse(textContent.text);
        return parsed.data || [];
      }
    }

    return [];
  }

  /**
   * Get detailed information about a workflow
   * @param {string} workflowId - Workflow ID
   * @returns {Promise<Object>} Workflow details
   */
  async getWorkflowDetails(workflowId) {
    const result = await this.sendRequest('tools/call', {
      name: 'get_workflow_details',
      arguments: { workflowId },
    });

    if (result.structuredContent) {
      return result.structuredContent;
    }

    // Fallback: try content array
    if (result.content && Array.isArray(result.content)) {
      const textContent = result.content.find((c) => c.type === 'text');
      if (textContent) {
        return JSON.parse(textContent.text);
      }
    }

    return result;
  }

  /**
   * Execute a workflow via MCP
   * @param {string} workflowId - Workflow ID to execute
   * @param {string} chatInput - Chat message input
   * @param {string} _sessionId - Session ID for conversation tracking (reserved for future use)
   * @returns {Promise<string>} Workflow response content
   */
  async executeWorkflow(workflowId, chatInput, _sessionId) {
    const result = await this.sendRequest('tools/call', {
      name: 'execute_workflow',
      arguments: {
        workflowId,
        inputs: {
          type: 'chat',
          chatInput,
        },
      },
    });

    // Extract response from workflow execution result
    return this.extractWorkflowResponse(result);
  }

  /**
   * Extract response content from workflow execution result
   * @param {Object} result - Raw execution result
   * @returns {string} Extracted response content
   * @private
   */
  extractWorkflowResponse(result) {
    // Check structuredContent first
    const structured = result.structuredContent || result;

    if (!structured.success) {
      const errorMsg = structured.error || 'Workflow execution failed';
      throw new Error(`MCP workflow error: ${errorMsg}`);
    }

    // Navigate to the response in runData
    // Path: result.runData.<LastNode>[0].data.main[0][0].sendMessage
    const runData = structured.result?.runData;
    if (!runData) {
      throw new Error('MCP workflow error: No runData in response');
    }

    // Find the last executed node's output
    const lastNodeName = structured.result?.lastNodeExecuted;
    if (lastNodeName && runData[lastNodeName]) {
      const nodeOutput = runData[lastNodeName][0];
      if (nodeOutput?.data?.main?.[0]?.[0]) {
        const outputData = nodeOutput.data.main[0][0];
        // Check common output fields
        return (
          outputData.sendMessage ||
          outputData.text ||
          outputData.content ||
          outputData.output ||
          outputData.json?.content ||
          outputData.json?.text ||
          JSON.stringify(outputData.json || outputData)
        );
      }
    }

    // Fallback: try to find any sendMessage in runData
    for (const nodeName of Object.keys(runData)) {
      const nodeOutput = runData[nodeName][0];
      if (nodeOutput?.data?.main?.[0]?.[0]?.sendMessage) {
        return nodeOutput.data.main[0][0].sendMessage;
      }
    }

    throw new Error('MCP workflow error: Could not extract response from workflow');
  }
}

module.exports = McpClient;
