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
    const streamGenerator = n8nClient.streamCompletion(
      webhookUrl,
      messages,
      sessionId,
      userContext,
    );

    for await (const content of streamGenerator) {
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
