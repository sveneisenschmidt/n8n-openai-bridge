/**
 * Test Client Setup Helper
 * Shared N8nClient initialization for integration tests
 *
 * Copyright (c) 2025 Sven Eisenschmidt
 * Licensed under AGPL-3.0
 */

const N8nClient = require('../../../src/n8nClient');

/**
 * Create test client with default config
 * @returns {N8nClient}
 */
function createTestClient() {
  const mockConfig = { n8nBearerToken: '' };
  return new N8nClient(mockConfig);
}

module.exports = { createTestClient };
