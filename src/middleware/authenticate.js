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

const { sendError } = require('../utils/errorResponse');

/**
 * Authentication middleware
 * Validates Bearer token from Authorization header
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
    if (token !== config.bearerToken) {
      return sendError(res, 401, 'Invalid token', 'authentication_error');
    }

    next();
  };
}

module.exports = authenticate;
