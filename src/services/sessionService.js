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
 * Service for extracting session identifiers from requests
 */

/**
 * Extracts session ID from request with fallback priority:
 * 1. Request body fields (session_id, conversation_id, chat_id)
 * 2. Configured HTTP headers
 * 3. Generated UUID (fallback)
 *
 * @param {Object} req - Express request object
 * @param {Array<string>} sessionIdHeaders - Configured header names to check
 * @param {Function} uuidGenerator - Function to generate UUID (for testing)
 * @returns {Object} { sessionId: string, source: string }
 */
function extractSessionId(req, sessionIdHeaders, uuidGenerator) {
  let sessionId = null;
  let sessionSource = null;

  // 1. Try body fields first
  if (req.body?.session_id) {
    sessionId = req.body.session_id;
    sessionSource = 'req.body.session_id';
  } else if (req.body?.conversation_id) {
    sessionId = req.body.conversation_id;
    sessionSource = 'req.body.conversation_id';
  } else if (req.body?.chat_id) {
    sessionId = req.body.chat_id;
    sessionSource = 'req.body.chat_id';
  }

  // 2. Try configured headers in order
  if (!sessionId) {
    for (const headerName of sessionIdHeaders) {
      const lowerHeaderName = headerName.toLowerCase();
      if (req.headers[lowerHeaderName]) {
        sessionId = req.headers[lowerHeaderName];
        sessionSource = `headers[${headerName}]`;
        break;
      }
    }
  }

  // 3. Fallback to UUID
  if (!sessionId) {
    sessionId = uuidGenerator();
    sessionSource = 'generated (new UUID)';
  }

  return { sessionId, sessionSource };
}

module.exports = {
  extractSessionId,
};
