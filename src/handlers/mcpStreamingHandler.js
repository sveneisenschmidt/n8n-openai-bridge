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

const { createStreamingChunk } = require('../utils/openaiResponse');
const { createErrorResponse } = require('../utils/errorResponse');

/**
 * Handles streaming chat completion requests via MCP
 *
 * Note: MCP execute_workflow returns the full response at once,
 * so we simulate streaming by sending the content in a single chunk.
 *
 * @param {Object} res - Express response object
 * @param {Object} mcpClient - MCP client instance
 * @param {string} workflowId - Workflow ID to execute
 * @param {Array<Object>} messages - Chat messages
 * @param {string} sessionId - Session identifier
 * @param {Object} userContext - User context data
 * @param {string} model - Model identifier
 * @param {Object} config - Configuration object
 * @returns {Promise<void>}
 */
async function handleMcpStreaming(
  res,
  mcpClient,
  workflowId,
  messages,
  sessionId,
  userContext,
  model,
  config,
) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    // Extract the last user message as chat input
    const lastUserMessage = messages.filter((m) => m.role === 'user').pop();
    const chatInput = lastUserMessage?.content || '';

    // Execute workflow via MCP
    const content = await mcpClient.executeWorkflow(workflowId, chatInput, sessionId);

    // MCP returns full response at once, send as single chunk
    if (content) {
      const chunk = createStreamingChunk(model, content, null);
      res.write(`data: ${JSON.stringify(chunk)}\n\n`);
    }

    // Send final chunk
    const finalChunk = createStreamingChunk(model, null, 'stop');
    res.write(`data: ${JSON.stringify(finalChunk)}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();

    if (config.logRequests) {
      console.log(`MCP streaming completed for session: ${sessionId}`);
    }
  } catch (streamError) {
    console.error('MCP stream error:', streamError);
    const errorChunk = createErrorResponse('Error during MCP streaming', 'server_error');
    res.write(`data: ${JSON.stringify(errorChunk)}\n\n`);
    res.end();
  }
}

module.exports = { handleMcpStreaming };
