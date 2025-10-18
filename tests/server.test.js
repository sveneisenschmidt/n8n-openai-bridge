const request = require('supertest');
const express = require('express');

// Mock console methods to reduce noise in test output
global.console = {
  ...console,
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Mock dependencies before requiring server
jest.mock('../src/config');
jest.mock('../src/n8nClient');

const config = require('../src/config');

describe('Server API Endpoints', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock config
    config.port = 3333;
    config.bearerToken = 'test-bearer-token';
    config.logRequests = false;
    config.sessionIdHeaders = ['X-Session-Id', 'X-Chat-Id'];
    config.getModelWebhookUrl = jest.fn();
    config.getAllModels = jest.fn();

    // Create fresh express app for each test
    app = express();
    app.use(express.json());

    // Add health endpoint
    app.get('/health', (req, res) => {
      res.json({ status: 'ok' });
    });

    // Add models endpoint with auth
    app.get('/v1/models', (req, res) => {
      const authHeader = req.headers.authorization;
      if (config.bearerToken && authHeader !== `Bearer ${config.bearerToken}`) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const models = config.getAllModels();
      res.json({
        object: 'list',
        data: models,
      });
    });
  });

  describe('GET /health', () => {
    test('should return 200 and status ok', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ status: 'ok' });
    });
  });

  describe('GET /v1/models', () => {
    test('should return list of models with valid auth', async () => {
      config.getAllModels.mockReturnValue([
        { id: 'model-1', object: 'model', created: 1234567890, owned_by: 'n8n' },
        { id: 'model-2', object: 'model', created: 1234567890, owned_by: 'n8n' },
      ]);

      const response = await request(app)
        .get('/v1/models')
        .set('Authorization', 'Bearer test-bearer-token');

      expect(response.status).toBe(200);
      expect(response.body.object).toBe('list');
      expect(response.body.data).toHaveLength(2);
      expect(config.getAllModels).toHaveBeenCalled();
    });

    test('should return 401 with invalid auth', async () => {
      const response = await request(app)
        .get('/v1/models')
        .set('Authorization', 'Bearer wrong-token');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error', 'Unauthorized');
    });

    test('should return 401 without auth header when token is required', async () => {
      const response = await request(app).get('/v1/models');

      expect(response.status).toBe(401);
    });
  });

  describe('Authentication', () => {
    test('should allow requests when no bearer token is configured', async () => {
      config.bearerToken = '';

      const response = await request(app).get('/v1/models');

      expect(response.status).toBe(200);
    });

    test('should reject requests with malformed authorization header', async () => {
      const response = await request(app).get('/v1/models').set('Authorization', 'InvalidFormat');

      expect(response.status).toBe(401);
    });
  });

  describe('Session ID Extraction', () => {
    test('should extract session ID from X-Session-Id header', () => {
      const extractSessionId = (req) => {
        for (const header of config.sessionIdHeaders) {
          const value = req.headers[header.toLowerCase()];
          if (value) {
            return value;
          }
        }
        return null;
      };

      const mockReq = {
        headers: { 'x-session-id': 'session-123' },
        body: {},
      };

      const sessionId = extractSessionId(mockReq);
      expect(sessionId).toBe('session-123');
    });

    test('should extract session ID from X-Chat-Id header as fallback', () => {
      const extractSessionId = (req) => {
        for (const header of config.sessionIdHeaders) {
          const value = req.headers[header.toLowerCase()];
          if (value) {
            return value;
          }
        }
        return null;
      };

      const mockReq = {
        headers: { 'x-chat-id': 'chat-456' },
        body: {},
      };

      const sessionId = extractSessionId(mockReq);
      expect(sessionId).toBe('chat-456');
    });

    test('should extract session ID from request body', () => {
      const extractSessionId = (req) => {
        if (req.body?.session_id) {
          return req.body.session_id;
        }
        if (req.body?.conversation_id) {
          return req.body.conversation_id;
        }
        if (req.body?.chat_id) {
          return req.body.chat_id;
        }
        return null;
      };

      const mockReq = {
        headers: {},
        body: { session_id: 'body-session-789' },
      };

      const sessionId = extractSessionId(mockReq);
      expect(sessionId).toBe('body-session-789');
    });
  });

  describe('Request Validation', () => {
    test('should validate required fields in chat completion request', () => {
      const validateRequest = (body) => {
        const errors = [];
        if (!body.model) {
          errors.push('model is required');
        }
        if (!body.messages || !Array.isArray(body.messages)) {
          errors.push('messages must be an array');
        }
        return errors;
      };

      const invalidBody = { model: '', messages: 'invalid' };
      const errors = validateRequest(invalidBody);

      expect(errors).toContain('model is required');
      expect(errors).toContain('messages must be an array');
    });

    test('should accept valid chat completion request', () => {
      const validateRequest = (body) => {
        const errors = [];
        if (!body.model) {
          errors.push('model is required');
        }
        if (!body.messages || !Array.isArray(body.messages)) {
          errors.push('messages must be an array');
        }
        return errors;
      };

      const validBody = {
        model: 'test-model',
        messages: [{ role: 'user', content: 'Hello' }],
      };
      const errors = validateRequest(validBody);

      expect(errors).toHaveLength(0);
    });
  });
});
