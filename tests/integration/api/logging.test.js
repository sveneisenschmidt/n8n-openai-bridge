/**
 * Integration Tests: Request Logging
 * Tests request logging functionality
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

describe('Request Logging', () => {
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

  test('should log requests to console', async () => {
    await request(app).get('/health');

    expect(console.log).toHaveBeenCalled();
  });
});
