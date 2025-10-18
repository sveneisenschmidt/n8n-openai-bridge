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
 * Request ID middleware
 * Generates and tracks a unique ID for each request
 * Adds the ID to both the request object and response headers
 *
 * @returns {Function} Express middleware function
 */
function requestId() {
  return (req, res, next) => {
    // Check if request ID already exists (from proxy/load balancer)
    const existingId = req.headers['x-request-id'] || req.headers['x-correlation-id'];

    // Use existing ID or generate new one
    req.id = existingId || `req-${uuidv4()}`;

    // Add to response headers for tracing
    res.setHeader('X-Request-ID', req.id);

    // Log if enabled
    if (req.app.locals.config?.logRequests) {
      console.log(`[${req.id}] ${req.method} ${req.path}`);
    }

    next();
  };
}

module.exports = requestId;
