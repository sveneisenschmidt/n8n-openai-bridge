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
 * GET /health
 * Health check endpoint that returns server status and uptime
 * No authentication required
 *
 * @route GET /health
 * @returns {Object} 200 - Health status
 * @returns {string} 200.status - Always "ok"
 * @returns {number} 200.uptime - Server uptime in seconds
 *
 * @example
 * GET /health
 * Response:
 * {
 *   "status": "ok",
 *   "uptime": 123.456
 * }
 */
router.get('/', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
  });
});

module.exports = router;
