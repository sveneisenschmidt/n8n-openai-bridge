/**
 * Models Response Format Integration Tests
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

describe('GET /v1/models - Response Format', () => {
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

  test('should return OpenAI-compatible format', async () => {
    const response = await request(app)
      .get('/v1/models')
      .set('Authorization', 'Bearer test-bearer-token');

    expect(response.body.object).toBe('list');
    expect(response.body.data).toHaveLength(2);

    const model = response.body.data[0];
    expect(model).toHaveProperty('id');
    expect(model).toHaveProperty('object', 'model');
    expect(model).toHaveProperty('created');
    expect(model).toHaveProperty('owned_by', 'n8n');
  });

  test('should include all configured models', async () => {
    const response = await request(app)
      .get('/v1/models')
      .set('Authorization', 'Bearer test-bearer-token');

    const modelIds = response.body.data.map((m) => m.id);
    expect(modelIds).toContain('test-model');
    expect(modelIds).toContain('another-model');
  });
});
