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
const Bootstrap = require('./Bootstrap');
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
const bootstrap = new Bootstrap();
const n8nClient = new N8nClient(bootstrap.config, bootstrap.taskDetectorService);

// Store bootstrap and n8nClient in app.locals for access in routes
app.locals.bootstrap = bootstrap;
app.locals.config = bootstrap.config;
app.locals.modelRepository = bootstrap.modelRepository;
app.locals.n8nClient = n8nClient;

// Create rate limiters
const rateLimiters = createRateLimiters(bootstrap.config);

// Basic middleware
app.use(cors());
app.use(express.json({ limit: bootstrap.config.requestBodyLimit }));

// Request ID tracking (must be early in the chain)
app.use(requestId());

// Request logging middleware
app.use(requestLogger(bootstrap.config));

// Public routes (no authentication required)
app.use('/health', rateLimiters.health, healthRoute);

// Apply authentication to all subsequent routes
app.use(authenticate(bootstrap.config));

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
    // Initialize bootstrap (MUST succeed)
    await bootstrap.initialize();
    console.log(`Models loaded: ${bootstrap.modelRepository.getModelCount()} available`);
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
  const PORT = bootstrap.config.port;
  const server = app.listen(PORT, () => {
    // Apply server timeout configuration
    server.timeout = bootstrap.config.serverTimeout;
    server.keepAliveTimeout = bootstrap.config.serverKeepAliveTimeout;
    server.headersTimeout = bootstrap.config.serverHeadersTimeout;
    console.log('='.repeat(60));
    console.log(`Server running on port: ${PORT}`);
    console.log(`Request logging: ${bootstrap.config.logRequests ? 'ENABLED' : 'DISABLED'}`);
    console.log(`Session ID headers: ${bootstrap.config.sessionIdHeaders.join(', ')}`);
    console.log('='.repeat(60));
    console.log('Available Models:');
    const modelsList = bootstrap.modelRepository.getAllModels();
    if (modelsList.length > 0) {
      modelsList.forEach((model) => {
        console.log(`  - ${model.id}`);
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
    bootstrap.close(); // Stop model loader watching/polling
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
