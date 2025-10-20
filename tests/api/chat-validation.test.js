/**
 * Integration Tests: POST /v1/chat/completions - Validation
 * Tests request validation for chat completions endpoint
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

describe('POST /v1/chat/completions - Validation', () => {
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

  test('should return 400 when model is missing', async () => {
    const response = await request(app)
      .post('/v1/chat/completions')
      .set('Authorization', 'Bearer test-bearer-token')
      .send({
        messages: [{ role: 'user', content: 'Hello' }],
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toHaveProperty('type', 'invalid_request_error');
    expect(response.body.error.message).toContain('model');
  });

  test('should return 400 when messages is missing', async () => {
    const response = await request(app)
      .post('/v1/chat/completions')
      .set('Authorization', 'Bearer test-bearer-token')
      .send({
        model: 'test-model',
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toHaveProperty('type', 'invalid_request_error');
  });

  test('should return 400 when messages is not an array', async () => {
    const response = await request(app)
      .post('/v1/chat/completions')
      .set('Authorization', 'Bearer test-bearer-token')
      .send({
        model: 'test-model',
        messages: 'invalid',
      });

    expect(response.status).toBe(400);
    expect(response.body.error.message).toContain('array');
  });

  test('should return 400 when messages array is empty', async () => {
    const response = await request(app)
      .post('/v1/chat/completions')
      .set('Authorization', 'Bearer test-bearer-token')
      .send({
        model: 'test-model',
        messages: [],
      });

    expect(response.status).toBe(400);
    expect(response.body.error.message).toContain('non-empty');
  });

  test('should return 404 when model is not found', async () => {
    const response = await request(app)
      .post('/v1/chat/completions')
      .set('Authorization', 'Bearer test-bearer-token')
      .send({
        model: 'nonexistent-model',
        messages: [{ role: 'user', content: 'Hello' }],
      });

    expect(response.status).toBe(404);
    expect(response.body.error.message).toContain('not found');
  });
});
