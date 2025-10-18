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

const { maskSensitiveHeaders, maskSensitiveBody } = require('../utils/masking');

/**
 * Request logging middleware
 * Logs incoming requests with optional detailed logging
 *
 * @param {object} config - Configuration object with logRequests flag
 * @returns {Function} Express middleware function
 */
function requestLogger(config) {
  return (req, res, next) => {
    console.log(`${req.method} ${req.path}`);

    if (config.logRequests) {
      console.log('--- Incoming Request ---');
      console.log('Headers:', maskSensitiveHeaders(req.headers));
      console.log('Body:', maskSensitiveBody(req.body));
      console.log('Query:', req.query);
      console.log('------------------------');
    }

    next();
  };
}

module.exports = requestLogger;
