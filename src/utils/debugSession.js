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
 * Utility for debugging session ID detection
 */

/**
 * Logs detailed session ID detection information for debugging
 * @param {Object} req - Express request object
 * @param {Object} config - Configuration object
 */
function debugSessionDetection(req, config) {
  if (!config.logRequests) {
    return;
  }

  console.log('========== SESSION ID DETECTION ==========');
  console.log('Checking request body for session identifiers:');
  console.log(`  req.body.session_id: ${req.body.session_id || 'NOT FOUND'}`);
  console.log(`  req.body.conversation_id: ${req.body.conversation_id || 'NOT FOUND'}`);
  console.log(`  req.body.chat_id: ${req.body.chat_id || 'NOT FOUND'}`);

  console.log('Checking configured session ID headers:');
  config.sessionIdHeaders.forEach((headerName) => {
    const lowerHeaderName = headerName.toLowerCase();
    console.log(`  ${headerName}: ${req.headers[lowerHeaderName] || 'NOT FOUND'}`);
  });

  console.log(`All request body keys: ${Object.keys(req.body).join(', ')}`);
  console.log(`All header keys: ${Object.keys(req.headers).join(', ')}`);
  console.log('==========================================');
}

module.exports = {
  debugSessionDetection,
};
