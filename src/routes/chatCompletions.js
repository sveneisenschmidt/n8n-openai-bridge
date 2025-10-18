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

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { extractSessionId } = require('../services/sessionService');
const { extractUserContext } = require('../services/userService');
const { validateChatCompletionRequest } = require('../services/validationService');

const router = express.Router();

/**
 * POST /v1/chat/completions
 * Handles OpenAI-compatible chat completion requests with streaming support
 *
 * @route POST /v1/chat/completions
 * @param {Object} req.body - Request body
 * @param {string} req.body.model - Model identifier (must exist in models.json)
 * @param {Array<Object>} req.body.messages - Array of chat messages with role and content
 * @param {boolean} [req.body.stream=false] - Enable Server-Sent Events streaming
 * @param {string} [req.body.session_id] - Optional session identifier
 * @param {Object} [req.headers] - HTTP headers
 * @param {string} [req.headers.x-session-id] - Session ID from header
 * @param {string} [req.headers.x-user-id] - User ID from header
 * @param {string} [req.headers.x-user-email] - User email from header
 * @param {string} [req.headers.x-user-name] - User name from header
 * @param {string} [req.headers.x-user-role] - User role from header
 *
 * @returns {Object} 200 - Successful response
 * @returns {Object} 400 - Validation error (missing model, messages, or invalid format)
 * @returns {Object} 404 - Model not found in configuration
 * @returns {Object} 500 - Internal server error or n8n webhook failure
 *
 * @example
 * // Non-streaming request
 * POST /v1/chat/completions
 * {
 *   "model": "my-agent",
 *   "messages": [{"role": "user", "content": "Hello"}],
 *   "stream": false
 * }
 *
 * @example
 * // Streaming request
 * POST /v1/chat/completions
 * {
 *   "model": "my-agent",
 *   "messages": [{"role": "user", "content": "Hello"}],
 *   "stream": true
 * }
 */
router.post('/', async (req, res) => {
  const config = req.app.locals.config;
  const n8nClient = req.app.locals.n8nClient;

  const { model, messages, stream = false } = req.body;

  // SESSION ID DETECTION (Debug logging)
  if (config.logRequests) {
    console.log('========== SESSION ID DETECTION ==========');
    console.log('Checking request body for session identifiers:');
    console.log(`  req.body.session_id: ${req.body.session_id || 'NOT FOUND'}`);
    console.log(`  req.body.conversation_id: ${req.body.conversation_id || 'NOT FOUND'}`);
    console.log(`  req.body.chat_id: ${req.body.chat_id || 'NOT FOUND'}`);

    console.log('Checking configured session ID headers:');
    config.sessionIdHeaders.forEach((headerName) => {
      const lowerHeaderName = headerName.toLowerCase();
      console.log(`  ${headerName}: ${req.headers[lowerHeaderName] || 'NOT FOUND'}`);
    });

    console.log(`All request body keys: ${Object.keys(req.body).join(', ')}`);
    console.log(`All header keys: ${Object.keys(req.headers).join(', ')}`);
    console.log('==========================================');
  }

  // Validation
  const validation = validateChatCompletionRequest(req.body);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.error });
  }

  const webhookUrl = config.getModelWebhookUrl(model);
  if (!webhookUrl) {
    return res.status(404).json({
      error: {
        message: `Model '${model}' not found`,
        type: 'invalid_request_error',
      },
    });
  }

  // Extract session ID using service
  const { sessionId, sessionSource } = extractSessionId(req, config.sessionIdHeaders, uuidv4);

  // Extract user context using service
  const userContext = extractUserContext(req, config);

  if (config.logRequests) {
    console.log(`Session ID: ${sessionId}`);
    console.log(`Session Source: ${sessionSource}`);
    console.log(`User ID: ${userContext.userId}`);
    console.log(`User Email: ${userContext.userEmail || 'not provided'}`);
    console.log(`User Name: ${userContext.userName || 'not provided'}`);
    console.log(`User Role: ${userContext.userRole || 'not provided'}`);
    console.log(`Model: ${model}`);
    console.log(`Stream: ${stream}`);
  }

  try {
    if (stream) {
      // Streaming response
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
          const chunk = {
            id: `chatcmpl-${uuidv4()}`,
            object: 'chat.completion.chunk',
            created: Math.floor(Date.now() / 1000),
            model,
            choices: [
              {
                index: 0,
                delta: { content },
                finish_reason: null,
              },
            ],
          };

          res.write(`data: ${JSON.stringify(chunk)}\n\n`);
        }

        // Send final chunk
        const finalChunk = {
          id: `chatcmpl-${uuidv4()}`,
          object: 'chat.completion.chunk',
          created: Math.floor(Date.now() / 1000),
          model,
          choices: [
            {
              index: 0,
              delta: {},
              finish_reason: 'stop',
            },
          ],
        };

        res.write(`data: ${JSON.stringify(finalChunk)}\n\n`);
        res.write('data: [DONE]\n\n');
        res.end();

        if (config.logRequests) {
          console.log(`Streaming completed for session: ${sessionId}`);
        }
      } catch (streamError) {
        console.error(`[${new Date().toISOString()}] Stream error:`, streamError);
        const errorChunk = {
          error: {
            message: 'Error during streaming',
            type: 'server_error',
          },
        };
        res.write(`data: ${JSON.stringify(errorChunk)}\n\n`);
        res.end();
      }
    } else {
      // Non-streaming response
      const content = await n8nClient.nonStreamingCompletion(
        webhookUrl,
        messages,
        sessionId,
        userContext,
      );

      const response = {
        id: `chatcmpl-${uuidv4()}`,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model,
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content,
            },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 0,
          completion_tokens: 0,
          total_tokens: 0,
        },
      };

      if (config.logRequests) {
        console.log(`Non-streaming completed for session: ${sessionId}`);
      }

      res.json(response);
    }
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error:`, error);

    if (!res.headersSent) {
      res.status(500).json({
        error: {
          message: 'Internal server error',
          type: 'server_error',
        },
      });
    }
  }
});

module.exports = router;
