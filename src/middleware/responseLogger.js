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
 * Response logging middleware
 * Logs outgoing responses when LOG_RESPONSES is enabled
 *
 * @param {object} config - Configuration object with logResponses flag
 * @returns {Function} Express middleware function
 */
function responseLogger(config) {
  return (req, res, next) => {
    if (!config.logResponses) {
      return next();
    }

    // Wrap res.write() for streaming responses
    const originalWrite = res.write.bind(res);
    res.write = function (chunk, ...args) {
      if (chunk) {
        const data = chunk.toString().trim();
        if (data) {
          console.log(data);
        }
      }
      return originalWrite(chunk, ...args);
    };

    // Wrap res.json() for non-streaming responses
    const originalJson = res.json.bind(res);
    res.json = function (body) {
      console.log(JSON.stringify(body));
      return originalJson(body);
    };

    next();
  };
}

module.exports = responseLogger;
