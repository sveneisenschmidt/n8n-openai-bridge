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
const { createErrorResponse } = require('../utils/errorResponse');
const { debugSessionDetection } = require('../utils/debugSession');
const { handleStreaming } = require('../handlers/streamingHandler');
const { handleNonStreaming } = require('../handlers/nonStreamingHandler');

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
  const modelRepository = req.app.locals.modelRepository;
  const n8nClient = req.app.locals.n8nClient;

  const { model, messages, stream = false } = req.body;

  // SESSION ID DETECTION (Debug logging)
  debugSessionDetection(req, config);

  // Validation
  const validation = validateChatCompletionRequest(req.body);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.error });
  }

  const webhookUrl = modelRepository.getModelWebhookUrl(model);
  if (!webhookUrl) {
    return res
      .status(404)
      .json(createErrorResponse(`Model '${model}' not found`, 'invalid_request_error'));
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
      await handleStreaming(
        res,
        n8nClient,
        webhookUrl,
        messages,
        sessionId,
        userContext,
        model,
        config,
      );
    } else {
      await handleNonStreaming(
        res,
        n8nClient,
        webhookUrl,
        messages,
        sessionId,
        userContext,
        model,
        config,
      );
    }
  } catch (error) {
    console.error('Error:', error);

    if (!res.headersSent) {
      res.status(500).json(createErrorResponse('Internal server error', 'server_error'));
    }
  }
});

module.exports = router;
