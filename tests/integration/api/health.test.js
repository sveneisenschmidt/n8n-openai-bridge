/**
 * Health Endpoint Integration Tests
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

describe('GET /health', () => {
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

  test('should return 200 without authentication', async () => {
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('status', 'ok');
    expect(response.body).toHaveProperty('uptime');
  });
});
