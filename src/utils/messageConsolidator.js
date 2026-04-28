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

const { extractTextFromMultimodal, isMultimodalMessage } = require('./fileProcessor');

/**
 * Consolidates an array of messages into a single string with XML-like tags.
 * Used when session ID is generated to preserve conversation context for
 * n8n workflows that only read chatInput/currentMessage.
 *
 * @param {Array<Object>} messages - Array of message objects with role and content
 * @returns {string} Consolidated string with XML-like tags
 */
function consolidateMessages(messages) {
  if (!messages || messages.length === 0) {
    return '';
  }

  if (messages.length === 1) {
    const msg = messages[0];
    const content = isMultimodalMessage(msg) ? extractTextFromMultimodal(msg) : msg.content || '';
    return content;
  }

  const parts = messages.map((msg) => {
    const content = isMultimodalMessage(msg) ? extractTextFromMultimodal(msg) : msg.content || '';

    const role = msg.role || 'unknown';
    return `<${role}>${content}</${role}>`;
  });

  return parts.join('');
}

module.exports = {
  consolidateMessages,
};
