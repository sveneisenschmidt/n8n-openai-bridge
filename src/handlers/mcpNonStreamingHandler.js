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

const { createCompletionResponse } = require('../utils/openaiResponse');

/**
 * Handles non-streaming chat completion requests via MCP
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
async function handleMcpNonStreaming(
  res,
  mcpClient,
  workflowId,
  messages,
  sessionId,
  userContext,
  model,
  config,
) {
  // Extract the last user message as chat input
  const lastUserMessage = messages.filter((m) => m.role === 'user').pop();
  const chatInput = lastUserMessage?.content || '';

  // Execute workflow via MCP
  const content = await mcpClient.executeWorkflow(workflowId, chatInput, sessionId);

  const response = createCompletionResponse(model, content);

  if (config.logRequests) {
    console.log(`MCP non-streaming completed for session: ${sessionId}`);
  }

  res.json(response);
}

module.exports = { handleMcpNonStreaming };
