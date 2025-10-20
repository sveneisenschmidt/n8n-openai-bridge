/**
 * Integration Tests: CORS
 * Tests CORS headers and cross-origin request handling
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

describe('CORS', () => {
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

  test('should allow CORS requests', async () => {
    const response = await request(app).get('/health').set('Origin', 'http://example.com');

    expect(response.headers).toHaveProperty('access-control-allow-origin');
  });
});
