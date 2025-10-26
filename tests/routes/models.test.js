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
const modelsRoute = require('../../src/routes/models');
const ModelRepository = require('../../src/repositories/ModelRepository');

describe('Models Route - GET /v1/models', () => {
  let app;
  let modelRepository;

  beforeEach(() => {
    // Create Express app with route
    app = express();
    app.use(express.json());

    // Create ModelRepository instance with test data
    modelRepository = new ModelRepository();
    modelRepository.models = {
      'test-model': 'https://n8n.example.com/webhook/test/chat',
      'another-model': 'https://n8n.example.com/webhook/another/chat',
    };

    // Store modelRepository in app.locals (new structure)
    app.locals.modelRepository = modelRepository;

    // Mount route
    app.use('/', modelsRoute);
  });

  describe('Response Structure', () => {
    test('should return 200 status', async () => {
      const response = await request(app).get('/');

      expect(response.status).toBe(200);
    });

    test('should return JSON content-type', async () => {
      const response = await request(app).get('/');

      expect(response.headers['content-type']).toMatch(/json/);
    });

    test('should return object with "list" type', async () => {
      const response = await request(app).get('/').expect(200);

      expect(response.body.object).toBe('list');
    });

    test('should return data as array', async () => {
      const response = await request(app).get('/').expect(200);

      expect(Array.isArray(response.body.data)).toBe(true);
    });

    test('should have exactly two root properties', async () => {
      const response = await request(app).get('/').expect(200);

      expect(Object.keys(response.body).length).toBe(2);
      expect(response.body).toHaveProperty('object');
      expect(response.body).toHaveProperty('data');
    });
  });

  describe('Model Format (OpenAI Compatible)', () => {
    test('should return models in correct format', async () => {
      const response = await request(app).get('/').expect(200);

      response.body.data.forEach((model) => {
        expect(model).toHaveProperty('id');
        expect(model).toHaveProperty('object', 'model');
        expect(model).toHaveProperty('created');
        expect(model).toHaveProperty('owned_by', 'n8n');
      });
    });

    test('should have id as string', async () => {
      const response = await request(app).get('/').expect(200);

      response.body.data.forEach((model) => {
        expect(typeof model.id).toBe('string');
        expect(model.id.length).toBeGreaterThan(0);
      });
    });

    test('should have object always "model"', async () => {
      const response = await request(app).get('/').expect(200);

      response.body.data.forEach((model) => {
        expect(model.object).toBe('model');
      });
    });

    test('should have created as unix timestamp', async () => {
      const response = await request(app).get('/').expect(200);

      response.body.data.forEach((model) => {
        expect(typeof model.created).toBe('number');
        expect(model.created).toBeGreaterThan(0);
        expect(model.created).toBeGreaterThan(1577836800);
      });
    });

    test('should have owned_by always "n8n"', async () => {
      const response = await request(app).get('/').expect(200);

      response.body.data.forEach((model) => {
        expect(model.owned_by).toBe('n8n');
      });
    });
  });

  describe('Model Content', () => {
    test('should return configured models', async () => {
      const response = await request(app).get('/').expect(200);

      const modelIds = response.body.data.map((m) => m.id);
      expect(modelIds).toContain('test-model');
      expect(modelIds).toContain('another-model');
    });

    test('should have no duplicate model IDs', async () => {
      const response = await request(app).get('/').expect(200);

      const modelIds = response.body.data.map((m) => m.id);
      const uniqueIds = new Set(modelIds);

      expect(modelIds.length).toBe(uniqueIds.size);
    });

    test('should have no extra properties in model objects', async () => {
      const response = await request(app).get('/').expect(200);

      response.body.data.forEach((model) => {
        const allowedKeys = ['id', 'object', 'created', 'owned_by'];
        const keys = Object.keys(model);

        expect(keys.length).toBe(allowedKeys.length);
        keys.forEach((key) => {
          expect(allowedKeys).toContain(key);
        });
      });
    });

    test('should return empty array when no models configured', async () => {
      modelRepository.models = {};

      const response = await request(app).get('/').expect(200);

      expect(response.body.object).toBe('list');
      expect(response.body.data).toEqual([]);
    });
  });

  describe('Consistency', () => {
    test('should return same models on repeated calls', async () => {
      const response1 = await request(app).get('/').expect(200);

      const response2 = await request(app).get('/').expect(200);

      const ids1 = response1.body.data.map((m) => m.id).sort();
      const ids2 = response2.body.data.map((m) => m.id).sort();

      expect(ids1).toEqual(ids2);
    });

    test('should handle multiple rapid requests', async () => {
      const requests = Array.from({ length: 10 }, () => request(app).get('/'));

      const responses = await Promise.all(requests);

      responses.forEach((response) => {
        expect(response.status).toBe(200);
        expect(response.body.object).toBe('list');
        expect(Array.isArray(response.body.data)).toBe(true);
      });
    });
  });

  describe('HTTP Methods', () => {
    test('should only accept GET method', async () => {
      const response = await request(app).post('/');

      expect(response.status).toBe(404);
    });

    test('should reject PUT method', async () => {
      const response = await request(app).put('/');

      expect(response.status).toBe(404);
    });

    test('should reject DELETE method', async () => {
      const response = await request(app).delete('/');

      expect(response.status).toBe(404);
    });

    test('should reject PATCH method', async () => {
      const response = await request(app).patch('/');

      expect(response.status).toBe(404);
    });
  });

  describe('Query Parameters', () => {
    test('should ignore query parameters', async () => {
      const response = await request(app).get('/?foo=bar&limit=10').expect(200);

      expect(response.body.object).toBe('list');
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });
});
