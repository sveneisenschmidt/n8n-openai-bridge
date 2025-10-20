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
const cors = require('cors');
const config = require('./config');
const N8nClient = require('./n8nClient');
const { createErrorResponse } = require('./utils/errorResponse');

// Middleware
const requestLogger = require('./middleware/requestLogger');
const authenticate = require('./middleware/authenticate');
const requestId = require('./middleware/requestId');
const createRateLimiters = require('./middleware/rateLimiter');

// Routes
const healthRoute = require('./routes/health');
const modelsRoute = require('./routes/models');
const chatCompletionsRoute = require('./routes/chatCompletions');
const adminReloadRoute = require('./routes/adminReload');

const app = express();
const n8nClient = new N8nClient(config);

// Store config and n8nClient in app.locals for access in routes
app.locals.config = config;
app.locals.n8nClient = n8nClient;

// Create rate limiters
const rateLimiters = createRateLimiters(config);

// Basic middleware
app.use(cors());
app.use(express.json());

// Request ID tracking (must be early in the chain)
app.use(requestId());

// Request logging middleware
app.use(requestLogger(config));

// Public routes (no authentication required)
app.use('/health', rateLimiters.health, healthRoute);

// Apply authentication to all subsequent routes
app.use(authenticate(config));

// Protected routes (authentication required)
app.use('/admin/reload', rateLimiters.standard, adminReloadRoute);
app.use('/v1/models', rateLimiters.standard, modelsRoute);
app.use('/v1/chat/completions', rateLimiters.chatCompletions, chatCompletionsRoute);

// Error handler
app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json(createErrorResponse('Internal server error', 'server_error'));
});

// Start server
const PORT = config.port;
const server = app.listen(PORT, () => {
  console.log('='.repeat(60));
  console.log('n8n OpenAI Bridge');
  console.log('='.repeat(60));
  console.log(`Server running on port: ${PORT}`);
  console.log(`Request logging: ${config.logRequests ? 'ENABLED' : 'DISABLED'}`);
  console.log(`Session ID headers: ${config.sessionIdHeaders.join(', ')}`);
  console.log('='.repeat(60));
  console.log('Available Models:');
  const modelsList = Object.keys(config.models);
  if (modelsList.length > 0) {
    modelsList.forEach((modelId) => {
      console.log(`  - ${modelId}`);
    });
  } else {
    console.log('  (no models configured)');
  }
  console.log('='.repeat(60));
  console.log('Endpoints:');
  console.log('  GET  /health');
  console.log('  GET  /v1/models');
  console.log('  POST /v1/chat/completions');
  console.log('  POST /admin/reload');
  console.log('='.repeat(60));
});

module.exports = app;
module.exports.server = server;
