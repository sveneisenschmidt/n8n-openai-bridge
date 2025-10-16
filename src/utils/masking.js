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
 * Utility functions for masking sensitive information in logs
 */

/**
 * Masks sensitive information in HTTP headers
 * @param {Object} headers - Request headers
 * @returns {Object} Headers with masked sensitive values
 */
function maskSensitiveHeaders(headers) {
  const masked = { ...headers };

  if (masked.authorization) {
    const parts = masked.authorization.split(' ');
    if (parts.length === 2) {
      const token = parts[1];
      if (token.length > 12) {
        masked.authorization = `${parts[0]} ${token.substring(0, 8)}...${token.substring(token.length - 4)}`;
      }
    }
  }

  return masked;
}

/**
 * Masks sensitive information in request body
 * @param {Object} body - Request body
 * @returns {Object} Body with masked sensitive values
 */
function maskSensitiveBody(body) {
  if (!body || typeof body !== 'object') {
    return body;
  }

  const masked = { ...body };

  // Mask API keys if present
  if (masked.api_key && typeof masked.api_key === 'string') {
    const key = masked.api_key;
    if (key.length > 12) {
      masked.api_key = `${key.substring(0, 8)}...${key.substring(key.length - 4)}`;
    }
  }

  return masked;
}

module.exports = {
  maskSensitiveHeaders,
  maskSensitiveBody,
};