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

const {
  createStreamingChunk,
  createStatus,
  createStatusToolCallChunks,
  createTypeStatusChunk,
} = require('../utils/openaiResponse');
const { createErrorResponse } = require('../utils/errorResponse');

/**
 * Emits a status update based on configured format
 *
 * @param {Object} res - Express response object
 * @param {Object} config - Configuration object
 * @param {string} model - Model identifier
 * @param {string} message - Status message
 * @param {boolean} done - Whether this is the final status
 */
function emitStatus(res, config, model, message, done = false) {
  if (!config.enableStatusEmit) {
    return;
  }

  const status = createStatus(message, done);

  switch (config.statusEmitFormat) {
    case 'type_status': {
      const statusChunk = createTypeStatusChunk(model, status);
      res.write(`data: ${JSON.stringify(statusChunk)}\n\n`);
      break;
    }
    case 'tool_calls':
    default: {
      // tool_calls format requires multiple chunks
      const chunks = createStatusToolCallChunks(model, status);
      chunks.forEach((chunk) => {
        res.write(`data: ${JSON.stringify(chunk)}\n\n`);
      });
      break;
    }
  }
}

/**
 * Handles streaming chat completion requests
 *
 * @param {Object} res - Express response object
 * @param {Object} n8nClient - N8N client instance
 * @param {string} webhookUrl - Webhook URL for the model
 * @param {Array<Object>} messages - Chat messages
 * @param {string} sessionId - Session identifier
 * @param {Object} userContext - User context data
 * @param {string} model - Model identifier
 * @param {Object} config - Configuration object
 * @returns {Promise<void>}
 */
async function handleStreaming(
  res,
  n8nClient,
  webhookUrl,
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
    // Status: Processing (before calling n8n)
    emitStatus(res, config, model, 'Processing');

    const streamGenerator = n8nClient.streamCompletion(
      webhookUrl,
      messages,
      sessionId,
      userContext,
    );

    let firstChunk = true;

    for await (const content of streamGenerator) {
      // Status: Completed (when first content chunk arrives from n8n)
      if (firstChunk) {
        emitStatus(res, config, model, 'Completed', true);
        firstChunk = false;
      }

      const chunk = createStreamingChunk(model, content, null);
      res.write(`data: ${JSON.stringify(chunk)}\n\n`);
    }

    // Send final chunk
    const finalChunk = createStreamingChunk(model, null, 'stop');
    res.write(`data: ${JSON.stringify(finalChunk)}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();

    if (config.logRequests) {
      console.log(`Streaming completed for session: ${sessionId}`);
    }
  } catch (streamError) {
    console.error('Stream error:', streamError);
    const errorChunk = createErrorResponse('Error during streaming', 'server_error');
    res.write(`data: ${JSON.stringify(errorChunk)}\n\n`);
    res.end();
  }
}

module.exports = { handleStreaming };
