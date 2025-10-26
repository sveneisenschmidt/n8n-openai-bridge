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
const { createErrorResponse } = require('../utils/errorResponse');

const router = express.Router();

/**
 * POST /admin/reload
 * Reloads the models configuration from models.json without restarting the server
 *
 * @route POST /admin/reload
 * @returns {Object} 200 - Models reloaded successfully
 * @returns {Object} 200.status - Status: "ok"
 * @returns {Object} 200.message - Message: "Models reloaded"
 * @returns {number} 200.models - Number of models loaded
 * @returns {Object} 500 - Failed to reload models (file error, JSON parse error, etc.)
 *
 * @example
 * POST /admin/reload
 * Response:
 * {
 *   "status": "ok",
 *   "message": "Models reloaded",
 *   "models": 3
 * }
 */
router.post('/', async (req, res) => {
  const bootstrap = req.app.locals.bootstrap;
  const modelRepository = req.app.locals.modelRepository;

  try {
    await modelRepository.reloadModels(bootstrap.modelLoader);
    res.json({
      status: 'ok',
      message: 'Models reloaded',
      models: modelRepository.getModelCount(),
    });
  } catch (error) {
    res.status(500).json(createErrorResponse(error.message));
  }
});

module.exports = router;
