/*
 * n8n OpenAI Bridge
 * Copyright (C) 2025 Sven Eisenschmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

const express = require('express');
const request = require('supertest');
const chatCompletionsRoute = require('../../src/routes/chatCompletions');
const Config = require('../../src/config/Config');
const ModelRepository = require('../../src/repositories/ModelRepository');

describe('chatCompletions route', () => {
  let app;
  let config;
  let modelRepository;
  let mockN8nClient;
  let consoleErrorSpy;

  beforeEach(() => {
    // Mock console.error to avoid cluttering test output
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

    // Create Express app with route
    app = express();
    app.use(express.json());

    // Create Config instance (new structure)
    config = new Config();
    config.logRequests = false;
    config.sessionIdHeaders = ['X-Session-Id'];
    config.userIdHeaders = ['X-User-Id'];
    config.userEmailHeaders = ['X-User-Email'];
    config.userNameHeaders = ['X-User-Name'];
    config.userRoleHeaders = ['X-User-Role'];

    // Create ModelRepository instance (new structure)
    modelRepository = new ModelRepository();

    // Mock n8nClient
    mockN8nClient = {
      streamCompletion: jest.fn(),
      nonStreamingCompletion: jest.fn(),
    };

    // Store in app.locals (new structure)
    app.locals.config = config;
    app.locals.modelRepository = modelRepository;
    app.locals.n8nClient = mockN8nClient;

    // Mount route
    app.use('/', chatCompletionsRoute);
  });

  afterEach(() => {
    // Restore console.error
    if (consoleErrorSpy) {
      consoleErrorSpy.mockRestore();
    }
  });

  describe('POST /', () => {
    describe('validation', () => {
      it('should return 400 if model is missing', async () => {
        const response = await request(app)
          .post('/')
          .send({
            messages: [{ role: 'user', content: 'Hello' }],
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toBeDefined();
      });

      it('should return 400 if messages is missing', async () => {
        const response = await request(app).post('/').send({
          model: 'test-model',
        });

        expect(response.status).toBe(400);
        expect(response.body.error).toBeDefined();
      });

      it('should return 400 if messages is empty', async () => {
        const response = await request(app).post('/').send({
          model: 'test-model',
          messages: [],
        });

        expect(response.status).toBe(400);
        expect(response.body.error).toBeDefined();
      });

      it('should return 400 if messages is not an array', async () => {
        const response = await request(app).post('/').send({
          model: 'test-model',
          messages: 'not an array',
        });

        expect(response.status).toBe(400);
        expect(response.body.error).toBeDefined();
      });
    });

    describe('model validation', () => {
      it('should return 404 if model is not found', async () => {
        // Model not in repository
        modelRepository.models = {};

        const response = await request(app)
          .post('/')
          .send({
            model: 'unknown-model',
            messages: [{ role: 'user', content: 'Hello' }],
          });

        expect(response.status).toBe(404);
        expect(response.body.error).toEqual({
          message: "Model 'unknown-model' not found",
          type: 'invalid_request_error',
        });
      });
    });

    describe('non-streaming mode', () => {
      beforeEach(() => {
        // Add test model to repository
        modelRepository.models = {
          'test-model': 'https://n8n.example.com/webhook/test',
        };
      });

      it('should return successful response for valid request', async () => {
        mockN8nClient.nonStreamingCompletion.mockResolvedValue('Hello! How can I help you?');

        const response = await request(app)
          .post('/')
          .send({
            model: 'test-model',
            messages: [{ role: 'user', content: 'Hello' }],
            stream: false,
          });

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({
          object: 'chat.completion',
          model: 'test-model',
          choices: [
            {
              index: 0,
              message: {
                role: 'assistant',
                content: 'Hello! How can I help you?',
              },
              finish_reason: 'stop',
            },
          ],
        });
        expect(response.body.id).toMatch(/^chatcmpl-/);
        expect(response.body.created).toBeGreaterThan(0);
      });

      it('should default to non-streaming when stream is not specified', async () => {
        mockN8nClient.nonStreamingCompletion.mockResolvedValue('Response');

        const response = await request(app)
          .post('/')
          .send({
            model: 'test-model',
            messages: [{ role: 'user', content: 'Hello' }],
          });

        expect(response.status).toBe(200);
        expect(mockN8nClient.nonStreamingCompletion).toHaveBeenCalled();
      });

      it('should forward session ID from headers', async () => {
        mockN8nClient.nonStreamingCompletion.mockResolvedValue('Response');

        await request(app)
          .post('/')
          .set('X-Session-Id', 'session-123')
          .send({
            model: 'test-model',
            messages: [{ role: 'user', content: 'Hello' }],
          });

        expect(mockN8nClient.nonStreamingCompletion).toHaveBeenCalledWith(
          'https://n8n.example.com/webhook/test',
          [{ role: 'user', content: 'Hello' }],
          'session-123',
          expect.objectContaining({ userId: 'anonymous' }),
        );
      });

      it('should forward user context from headers', async () => {
        mockN8nClient.nonStreamingCompletion.mockResolvedValue('Response');

        await request(app)
          .post('/')
          .set('X-User-Id', 'user-456')
          .set('X-User-Email', 'test@example.com')
          .set('X-User-Name', 'Test User')
          .set('X-User-Role', 'admin')
          .send({
            model: 'test-model',
            messages: [{ role: 'user', content: 'Hello' }],
          });

        expect(mockN8nClient.nonStreamingCompletion).toHaveBeenCalledWith(
          'https://n8n.example.com/webhook/test',
          expect.any(Array),
          expect.any(String),
          {
            userId: 'user-456',
            userEmail: 'test@example.com',
            userName: 'Test User',
            userRole: 'admin',
          },
        );
      });

      it('should return 500 on n8nClient error', async () => {
        mockN8nClient.nonStreamingCompletion.mockRejectedValue(new Error('Connection failed'));

        const response = await request(app)
          .post('/')
          .send({
            model: 'test-model',
            messages: [{ role: 'user', content: 'Hello' }],
          });

        expect(response.status).toBe(500);
        expect(response.body.error).toEqual({
          message: 'Internal server error',
          type: 'server_error',
        });
      });
    });

    describe('streaming mode', () => {
      beforeEach(() => {
        // Add test model to repository
        modelRepository.models = {
          'test-model': 'https://n8n.example.com/webhook/test',
        };
      });

      it('should handle streaming response', async () => {
        async function* mockStreamGenerator() {
          yield 'Hello';
          yield ' ';
          yield 'World';
        }

        mockN8nClient.streamCompletion.mockReturnValue(mockStreamGenerator());

        const response = await request(app)
          .post('/')
          .send({
            model: 'test-model',
            messages: [{ role: 'user', content: 'Hello' }],
            stream: true,
          });

        expect(response.status).toBe(200);
        expect(response.headers['content-type']).toBe('text/event-stream');
        expect(response.text).toContain('data: ');
        expect(response.text).toContain('"delta":{"content":"Hello"}');
        expect(response.text).toContain('"delta":{"content":" "}');
        expect(response.text).toContain('"delta":{"content":"World"}');
        expect(response.text).toContain('"finish_reason":"stop"');
        expect(response.text).toContain('data: [DONE]');
      });

      it('should handle streaming error gracefully', async () => {
        async function* mockStreamGenerator() {
          yield 'Start';
          throw new Error('Stream error');
        }

        mockN8nClient.streamCompletion.mockReturnValue(mockStreamGenerator());

        const response = await request(app)
          .post('/')
          .send({
            model: 'test-model',
            messages: [{ role: 'user', content: 'Hello' }],
            stream: true,
          });

        expect(response.status).toBe(200);
        expect(response.text).toContain('Error during streaming');
      });

      it('should forward session and user context in streaming mode', async () => {
        async function* mockStreamGenerator() {
          yield 'Response';
        }

        mockN8nClient.streamCompletion.mockReturnValue(mockStreamGenerator());

        await request(app)
          .post('/')
          .set('X-Session-Id', 'session-789')
          .set('X-User-Id', 'user-123')
          .send({
            model: 'test-model',
            messages: [{ role: 'user', content: 'Hello' }],
            stream: true,
          });

        expect(mockN8nClient.streamCompletion).toHaveBeenCalledWith(
          'https://n8n.example.com/webhook/test',
          [{ role: 'user', content: 'Hello' }],
          'session-789',
          expect.objectContaining({ userId: 'user-123' }),
        );
      });
    });

    describe('session ID detection with logRequests enabled', () => {
      it('should log session detection when logRequests is true', async () => {
        // Enable debug logging
        config.logRequests = true;

        // Add test model to repository
        modelRepository.models = {
          'test-model': 'https://n8n.example.com/webhook/test',
        };
        mockN8nClient.nonStreamingCompletion.mockResolvedValue('Response');

        const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

        await request(app)
          .post('/')
          .set('X-Session-Id', 'test-session')
          .send({
            model: 'test-model',
            messages: [{ role: 'user', content: 'Hello' }],
            session_id: 'body-session',
          });

        expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('SESSION ID DETECTION'));

        consoleLogSpy.mockRestore();
      });
    });
  });
});
