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
 * Service for extracting user context from requests
 */

/**
 * Extracts user context from request with fallback priority:
 * 1. Configured HTTP headers (first-found-wins)
 * 2. Request body fields
 * 3. Defaults (userId: 'anonymous', others: null)
 *
 * @param {Object} req - Express request object
 * @param {Object} config - Configuration with header arrays
 * @returns {Object} { userId, userEmail, userName, userRole }
 */
function extractUserContext(req, config) {
  const { userIdHeaders, userEmailHeaders, userNameHeaders, userRoleHeaders } = config;
  const { user } = req.body || {};

  // Extract userId
  let userId = extractFromHeaders(req.headers, userIdHeaders);
  if (!userId) {
    userId = user || req.body?.user_id || req.body?.userId || 'anonymous';
  }

  // Extract userEmail
  let userEmail = extractFromHeaders(req.headers, userEmailHeaders);
  if (!userEmail) {
    userEmail = req.body?.user_email || req.body?.userEmail || null;
  }

  // Extract userName
  let userName = extractFromHeaders(req.headers, userNameHeaders);
  if (!userName) {
    userName = req.body?.user_name || req.body?.userName || null;
  }

  // Extract userRole
  let userRole = extractFromHeaders(req.headers, userRoleHeaders);
  if (!userRole) {
    userRole = req.body?.user_role || req.body?.userRole || null;
  }

  return {
    userId,
    userEmail,
    userName,
    userRole,
  };
}

/**
 * Extracts value from headers using configured header names (first-found-wins)
 * @param {Object} headers - Request headers
 * @param {Array<string>} headerNames - Header names to check
 * @returns {string|null} Header value or null
 */
function extractFromHeaders(headers, headerNames) {
  for (const headerName of headerNames) {
    const lowerHeaderName = headerName.toLowerCase();
    if (headers[lowerHeaderName]) {
      return headers[lowerHeaderName];
    }
  }
  return null;
}

module.exports = {
  extractUserContext,
  extractFromHeaders,
};
