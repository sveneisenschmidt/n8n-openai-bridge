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
const { sendError } = require('../utils/errorResponse');

/**
 * Timing-safe string comparison to prevent timing attacks
 * @param {string} a - First string to compare
 * @param {string} b - Second string to compare
 * @returns {boolean} True if strings are equal
 */
function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') {
    return false;
  }

  // Must be same length for timing-safe comparison
  if (a.length !== b.length) {
    return false;
  }

  // Use crypto.timingSafeEqual for constant-time comparison
  const bufferA = Buffer.from(a, 'utf8');
  const bufferB = Buffer.from(b, 'utf8');

  try {
    return crypto.timingSafeEqual(bufferA, bufferB);
  } catch {
    // Fallback if buffers can't be compared (shouldn't happen with utf8)
    return false;
  }
}

/**
 * Authentication middleware
 * Validates Bearer token from Authorization header using timing-safe comparison
 *
 * @param {object} config - Configuration object with bearerToken
 * @returns {Function} Express middleware function
 */
function authenticate(config) {
  return (req, res, next) => {
    if (!config.bearerToken) {
      return next();
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return sendError(res, 401, 'Unauthorized', 'authentication_error');
    }

    const token = authHeader.substring(7);

    // Use timing-safe comparison to prevent timing attacks
    if (!timingSafeEqual(token, config.bearerToken)) {
      return sendError(res, 401, 'Invalid token', 'authentication_error');
    }

    next();
  };
}

module.exports = authenticate;
