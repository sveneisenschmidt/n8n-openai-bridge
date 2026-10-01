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

const crypto = require('crypto');
const { createStreamingChunk } = require('../utils/openaiResponse');
const { createErrorResponse } = require('../utils/errorResponse');
const { emitExternalToolCompletions } = require('../utils/externalToolEvents');

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
  req,
  res,
  n8nClient,
  webhookUrl,
  messages,
  sessionId,
  userContext,
  model,
  config,
  activeStreamRegistry,
) {
  const streamId = crypto.randomUUID();
  let closed = false;
  let responseContent = '';

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();
  activeStreamRegistry.register(streamId, res, model);

  const cleanup = () => {
    closed = true;
    activeStreamRegistry.delete(streamId);
  };
  req.on('close', cleanup);

  try {
    const streamGenerator = n8nClient.streamCompletion(
      webhookUrl,
      messages,
      sessionId,
      userContext,
      streamId,
    );

    for await (const content of streamGenerator) {
      if (closed || res.writableEnded || res.destroyed) {
        break;
      }
      /**
       * Tool calls are emitted asynchronously through the OpenAI-compatible upstream side-channel.
       * n8n may split the final answer into fragments before that side-channel
       * has registered the tool (e.g. `get` + `al: 57`). Forwarding those
       * fragments immediately makes LibreChat discard the first fragment while
       * its current run step is still TOOL_CALLS. Buffer the authoritative n8n
       * response and emit it once after the stream has fully resolved, so the
       * tool lifecycle and complete final answer have a deterministic order.
       */
      responseContent += content;
    }

    if (!closed && !res.writableEnded && !res.destroyed) {
      /**
       * The answer must be delivered while the external tool card is still
       * active. LibreChat closes its graph branch once it receives the external
       * completion lifecycle event, so emitting content after that event drops
       * the entire answer. The response is still atomic because every n8n text
       * fragment was accumulated above.
       */
      if (responseContent) {
        const chunk = createStreamingChunk(model, responseContent, null);
        res.write(`data: ${JSON.stringify(chunk)}\n\n`);
      }
      emitExternalToolCompletions(activeStreamRegistry, streamId);
      const finalChunk = createStreamingChunk(model, null, 'stop');
      res.write(`data: ${JSON.stringify(finalChunk)}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
    }

    if (config.logRequests) {
      console.log(`Streaming completed for session: ${sessionId}`);
    }
  } catch (streamError) {
    console.error('Stream error:', streamError);
    if (!closed && !res.writableEnded && !res.destroyed) {
      const errorChunk = createErrorResponse('Error during streaming', 'server_error');
      res.write(`data: ${JSON.stringify(errorChunk)}\n\n`);
      res.end();
    }
  } finally {
    req.off('close', cleanup);
    activeStreamRegistry.delete(streamId);
  }
}

module.exports = { handleStreaming };
