/**
 * Test Server Setup Helper
 * Shared server initialization for integration tests
 *
 * Copyright (c) 2025 Sven Eisenschmidt
 * Licensed under AGPL-3.0
 */

const fs = require('fs');
const path = require('path');

/**
 * Setup test server with mocked environment
 * @returns {Object} { app, cleanup }
 */
function setupTestServer() {
  // Save original environment
  const originalEnv = { ...process.env };

  // Set NODE_ENV to test BEFORE requiring any modules
  process.env.NODE_ENV = 'test';

  // Create temporary models.json for testing
  const tempConfigPath = path.join(__dirname, '..', 'integration-test-models.json');
  const testModels = {
    'test-model': 'https://n8n.example.com/webhook/test/chat',
    'another-model': 'https://n8n.example.com/webhook/another/chat',
  };
  fs.writeFileSync(tempConfigPath, JSON.stringify(testModels, null, 2));

  // Set test environment
  process.env.MODELS_CONFIG_FILE = tempConfigPath;
  process.env.PORT = '3333';
  process.env.BEARER_TOKEN = 'test-bearer-token';
  process.env.LOG_REQUESTS = 'false';
  process.env.SESSION_ID_HEADERS = 'X-Session-Id,X-Chat-Id';
  process.env.USER_ID_HEADERS = 'X-User-Id';
  process.env.USER_EMAIL_HEADERS = 'X-User-Email';
  process.env.USER_NAME_HEADERS = 'X-User-Name';
  process.env.USER_ROLE_HEADERS = 'X-User-Role';

  // Mock fs.watch to prevent file watching in tests
  const mockWatcher = {
    close: jest.fn(),
    on: jest.fn(),
    removeAllListeners: jest.fn(),
  };
  jest.spyOn(fs, 'watch').mockReturnValue(mockWatcher);

  // Clear module cache and require fresh instances
  jest.resetModules();

  // Mock n8nClient before requiring server
  jest.mock('../../src/n8nClient');

  const app = require('../../src/server');

  // Cleanup function
  const cleanup = async () => {
    // Close the server gracefully
    if (app.server) {
      await new Promise((resolve) => app.server.close(resolve));
    }

    // Restore environment
    process.env = originalEnv;

    // Restore fs mocks
    if (fs.watch.mockRestore) {
      fs.watch.mockRestore();
    }
    if (fs.readFileSync.mockRestore) {
      fs.readFileSync.mockRestore();
    }

    // Clean up temp file
    if (fs.existsSync(tempConfigPath)) {
      fs.unlinkSync(tempConfigPath);
    }

    // Clear module cache
    jest.resetModules();
  };

  return { app, cleanup, tempConfigPath };
}

module.exports = { setupTestServer };
