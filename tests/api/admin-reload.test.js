/**
 * Integration Tests: POST /admin/reload
 * Tests admin endpoint for reloading model configuration
 *
 * Copyright (c) 2025 Sven Eisenschmidt
 * Licensed under AGPL-3.0
 */

const request = require('supertest');
const fs = require('fs');
const { setupTestServer } = require('../helpers/test-server');

// Mock console methods to reduce noise in test output
global.console = {
  ...console,
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

describe('POST /admin/reload', () => {
  let app;
  let cleanup;
  let tempConfigPath;

  beforeAll(() => {
    const setup = setupTestServer();
    app = setup.app;
    cleanup = setup.cleanup;
    tempConfigPath = setup.tempConfigPath;
  });

  afterAll(() => {
    cleanup();
  });

  test('should require authentication', async () => {
    const response = await request(app).post('/admin/reload');

    expect(response.status).toBe(401);
  });

  test('should reload models configuration', async () => {
    // Ensure the config file exists before reload
    const testModels = {
      'test-model': 'https://n8n.example.com/webhook/test/chat',
      'another-model': 'https://n8n.example.com/webhook/another/chat',
    };
    fs.writeFileSync(tempConfigPath, JSON.stringify(testModels, null, 2));

    const response = await request(app)
      .post('/admin/reload')
      .set('Authorization', 'Bearer test-bearer-token');

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('status', 'ok');
    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('models');
  });
});
