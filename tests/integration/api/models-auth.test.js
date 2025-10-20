/**
 * Models Authentication Integration Tests
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

describe('GET /v1/models - Authentication', () => {
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

  test('should return 401 without Authorization header', async () => {
    const response = await request(app).get('/v1/models');

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toHaveProperty('type', 'authentication_error');
  });

  test('should return 401 with invalid Bearer token', async () => {
    const response = await request(app)
      .get('/v1/models')
      .set('Authorization', 'Bearer wrong-token');

    expect(response.status).toBe(401);
    expect(response.body.error).toHaveProperty('type', 'authentication_error');
  });

  test('should return 401 with malformed Authorization header', async () => {
    const response = await request(app).get('/v1/models').set('Authorization', 'InvalidFormat');

    expect(response.status).toBe(401);
  });

  test('should return 200 with valid Bearer token', async () => {
    const response = await request(app)
      .get('/v1/models')
      .set('Authorization', 'Bearer test-bearer-token');

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('object', 'list');
    expect(response.body).toHaveProperty('data');
    expect(Array.isArray(response.body.data)).toBe(true);
  });
});
