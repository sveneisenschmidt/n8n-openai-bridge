/**
 * Test Client Setup Helper
 * Shared N8nClient initialization for integration tests
 *
 * Copyright (c) 2025 Sven Eisenschmidt
 * Licensed under AGPL-3.0
 */

const N8nClient = require('../../src/n8nClient');

/**
 * Create test client with default config
 * @param {Object} configOverrides - Optional config overrides
 * @returns {N8nClient}
 */
function createTestClient(configOverrides = {}) {
  const mockConfig = {
    n8nBearerToken: '',
    n8nTimeout: 300000,
    ...configOverrides,
  };
  return new N8nClient(mockConfig);
}

module.exports = { createTestClient };
