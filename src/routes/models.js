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

const express = require('express');

const router = express.Router();

/**
 * GET /v1/models
 * Returns a list of available models in OpenAI-compatible format
 *
 * @route GET /v1/models
 * @returns {Object} 200 - List of available models
 * @returns {string} 200.object - Always "list"
 * @returns {Array<Object>} 200.data - Array of model objects
 * @returns {string} 200.data[].id - Model identifier
 * @returns {string} 200.data[].object - Always "model"
 * @returns {number} 200.data[].created - Unix timestamp
 * @returns {string} 200.data[].owned_by - Always "n8n"
 *
 * @example
 * GET /v1/models
 * Response:
 * {
 *   "object": "list",
 *   "data": [
 *     {
 *       "id": "my-agent",
 *       "object": "model",
 *       "created": 1234567890,
 *       "owned_by": "n8n"
 *     }
 *   ]
 * }
 */
router.get('/', (req, res) => {
  const modelRepository = req.app.locals.modelRepository;
  const models = modelRepository.getAllModels();

  res.json({
    object: 'list',
    data: models,
  });
});

module.exports = router;
