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

const { v4: uuidv4 } = require('uuid');

/**
 * Creates an OpenAI-compatible streaming chunk
 *
 * @param {string} model - Model identifier
 * @param {string} content - Content to include in the delta
 * @param {string|null} finishReason - Finish reason ('stop' or null)
 * @returns {Object} OpenAI-compatible chunk object
 */
function createStreamingChunk(model, content, finishReason = null) {
  return {
    id: `chatcmpl-${uuidv4()}`,
    object: 'chat.completion.chunk',
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [
      {
        index: 0,
        delta: content ? { content } : {},
        finish_reason: finishReason,
      },
    ],
  };
}

/**
 * Creates an OpenAI-compatible non-streaming completion response
 *
 * @param {string} model - Model identifier
 * @param {string} content - Assistant response content
 * @returns {Object} OpenAI-compatible completion object
 */
function createCompletionResponse(model, content) {
  return {
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
}

/**
 * Creates a standardized status object
 *
 * @param {string} message - Status message
 * @param {boolean} done - Whether this is the final status
 * @returns {Object} Standardized status object
 */
function createStatus(message, done = false) {
  return {
    message,
    done,
  };
}

/**
 * Creates an OpenAI-compatible tool call chunk for status updates
 *
 * @param {string} model - Model identifier
 * @param {Object} status - Status object from createStatus()
 * @returns {Object} OpenAI-compatible chunk with tool_calls
 */
function createStatusToolCallChunk(model, status) {
  const callId = `call_status_${Date.now()}`;

  return {
    id: `chatcmpl-${uuidv4()}`,
    object: 'chat.completion.chunk',
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [
      {
        index: 0,
        delta: {
          tool_calls: [
            {
              index: 0,
              id: callId,
              type: 'function',
              function: {
                name: 'emit_status',
                arguments: JSON.stringify({ message: status.message }),
              },
            },
          ],
        },
        finish_reason: null,
      },
    ],
  };
}

/**
 * Creates a type_status format chunk (Open WebUI compatible)
 *
 * @param {string} model - Model identifier (unused for type_status)
 * @param {Object} status - Status object from createStatus()
 * @returns {Object} type_status format object
 */
function createTypeStatusChunk(model, status) {
  const statusType = status.done ? 'complete' : 'info';

  return {
    type: 'status',
    data: {
      status: statusType,
      description: status.message,
      done: status.done,
    },
  };
}

module.exports = {
  createStreamingChunk,
  createCompletionResponse,
  createStatus,
  createStatusToolCallChunk,
  createTypeStatusChunk,
};
