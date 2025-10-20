/**
 * Integration Tests: Error Handling
 * Tests server error handling and error responses
 *
 * Copyright (c) 2025 Sven Eisenschmidt
 * Licensed under AGPL-3.0
 */

const request = require('supertest');
const { setupTestServer } = require('../helpers/test-server');

// Mock console methods to reduce noise in test output
global.console = {
  ...console,
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

describe('Error Handling', () => {
  let app;
  let cleanup;

  beforeAll(() => {
    const setup = setupTestServer();
    app = setup.app;
    cleanup = setup.cleanup;
  });

  afterAll(() => {
    cleanup();
  });

  test('should handle JSON parse errors gracefully', async () => {
    const response = await request(app)
      .post('/v1/chat/completions')
      .set('Authorization', 'Bearer test-bearer-token')
      .set('Content-Type', 'application/json')
      .send('invalid json');

    // Express returns 400 for malformed JSON by default
    expect([400, 500]).toContain(response.status);
  });
});
