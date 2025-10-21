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

/**
 * Start the server
 *
 * Startup sequence:
 * 1. Wait for models to load (MUST succeed)
 * 2. Start HTTP server
 * 3. Setup graceful shutdown handlers
 *
 * Error Handling:
 * - Models fail to load → Server does NOT start (process.exit(1))
 * - Empty models object → Server starts (0 models is acceptable)
 * - SIGTERM/SIGINT → Graceful shutdown (stop polling, close server)
 */
async function startServer() {
  console.log('='.repeat(60));
  console.log('n8n OpenAI Bridge');
  console.log('='.repeat(60));
  console.log('Loading models...');

  try {
    // MUST wait for models to load before starting server
    await config.loadingPromise;
    console.log(`Models loaded: ${Object.keys(config.models).length} available`);
  } catch (error) {
    console.error('='.repeat(60));
    console.error('FATAL: Failed to load models');
    console.error(error.message);
    console.error('='.repeat(60));
    console.error('Server cannot start without models.');
    console.error('Please check your configuration and try again.');
    console.error('='.repeat(60));
    process.exit(1); // Exit with error code
  }

  // Start HTTP server
  const PORT = config.port;
  const server = app.listen(PORT, () => {
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

  // Graceful shutdown handler
  const shutdown = (signal) => {
    console.log(`${signal} received, shutting down gracefully...`);
    config.close(); // Stop model loader watching/polling
    server.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  return server;
}

// Start server and handle startup errors
startServer()
  .then((server) => {
    app.server = server;
    module.exports.server = server;
  })
  .catch((error) => {
    console.error('Fatal error starting server:', error);
    process.exit(1);
  });

module.exports = app;
module.exports.server = null; // Will be set after startServer() completes
