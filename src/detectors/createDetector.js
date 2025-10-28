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
 * Creates a detector function based on regex pattern groups
 *
 * @param {Array<Array<RegExp>>} patternGroups - Array of pattern groups
 *   Each group is an array of regex patterns where ALL must match
 *   The task is detected if ANY group matches completely
 * @returns {Function} Detector function that takes messages array
 */
function createDetector(patternGroups) {
  return function detect(messages) {
    if (!Array.isArray(messages) || messages.length === 0) {
      return false;
    }

    // Check system message and last user message
    const messagesToCheck = [
      messages.find((m) => m.role === 'system')?.content || '',
      messages[messages.length - 1]?.content || '',
    ];

    const combinedContent = messagesToCheck.join(' ');

    // Check if ANY pattern group matches completely
    return patternGroups.some((patternGroup) => {
      // ALL patterns in this group must match
      return patternGroup.every((pattern) => pattern.test(combinedContent));
    });
  };
}

module.exports = createDetector;
