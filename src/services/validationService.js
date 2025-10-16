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

/**
 * Service for validating chat completion requests
 */

/**
 * Validates chat completion request body
 * @param {Object} body - Request body
 * @returns {Object} { valid: boolean, error: Object|null }
 */
function validateChatCompletionRequest(body) {
  const { model, messages } = body;

  if (!model || !messages) {
    return {
      valid: false,
      error: {
        message: 'Missing required fields: model, messages',
        type: 'invalid_request_error',
      },
    };
  }

  if (!Array.isArray(messages) || messages.length === 0) {
    return {
      valid: false,
      error: {
        message: 'messages must be a non-empty array',
        type: 'invalid_request_error',
      },
    };
  }

  return { valid: true, error: null };
}

module.exports = {
  validateChatCompletionRequest,
};