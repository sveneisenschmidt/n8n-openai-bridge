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

const TaskType = require('../constants/TaskType');

/**
 * Task detector registry for all supported clients
 *
 * Structure:
 * {
 *   [TaskType]: [
 *     [pattern1, pattern2, ...],  // Pattern group 1: ALL patterns must match
 *     [pattern3, pattern4, ...],  // Pattern group 2: ALL patterns must match
 *   ]
 * }
 *
 * A task is detected if ANY pattern group matches completely (all patterns in that group match)
 *
 * Each pattern group should have a comment indicating which client/template it matches
 */
const detectorRegistry = {
  [TaskType.GENERATE_TITLE]: [
    // OpenWebUI: "Generate a concise, 3-5 word title with an emoji summarizing the chat history."
    [/generate a concise.*3-5 word title.*emoji/i, /<chat_history>/i, /<\/chat_history>/i],
    // LibreChat: "Provide a concise, 5-word-or-less title for the conversation..."
    [
      /provide a concise.*5-word-or-less title/i,
      /title case conventions/i,
      /only return the title itself/i,
    ],
  ],

  [TaskType.GENERATE_TAGS]: [
    // OpenWebUI: "Generate 1-3 broad tags categorizing the main themes..."
    [/generate.*1-3.*broad tags.*categorizing/i, /<chat_history>/i, /<\/chat_history>/i],
    // LibreChat: Add patterns here when templates are available
  ],

  [TaskType.GENERATE_FOLLOW_UP_QUESTIONS]: [
    // OpenWebUI: "Suggest 3-5 relevant follow-up questions..."
    [/suggest.*3-5.*follow[-\s]?up questions/i, /<chat_history>/i, /<\/chat_history>/i],
    // LibreChat: Add patterns here when templates are available
  ],
};

module.exports = detectorRegistry;
