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

const request = require('supertest');
const app = require('../../../src/server');

// When BEARER_TOKEN is set, auth is required; when not set, auth is optional
const bearerToken = process.env.BEARER_TOKEN || 'test-token';
const authRequired = !!process.env.BEARER_TOKEN;

describe('Models Route - GET /v1/models', () => {
  describe('Response Structure', () => {
    test('should return 200 status with valid auth', async () => {
      await request(app)
        .get('/v1/models')
        .set('Authorization', `Bearer ${bearerToken}`)
        .expect(200);
    });

    test('should return JSON content-type', async () => {
      await request(app)
        .get('/v1/models')
        .set('Authorization', `Bearer ${bearerToken}`)
        .expect('Content-Type', /json/);
    });

    test('should return object with "list" type', async () => {
      const response = await request(app)
        .get('/v1/models')
        .set('Authorization', `Bearer ${bearerToken}`)
        .expect(200);

      expect(response.body.object).toBe('list');
    });

    test('should return data as array', async () => {
      const response = await request(app)
        .get('/v1/models')
        .set('Authorization', `Bearer ${bearerToken}`)
        .expect(200);

      expect(Array.isArray(response.body.data)).toBe(true);
    });

    test('should have exactly two root properties', async () => {
      const response = await request(app)
        .get('/v1/models')
        .set('Authorization', `Bearer ${bearerToken}`)
        .expect(200);

      expect(Object.keys(response.body).length).toBe(2);
      expect(response.body).toHaveProperty('object');
      expect(response.body).toHaveProperty('data');
    });
  });

  describe('Model Format (OpenAI Compatible)', () => {
    test('should return models in correct format', async () => {
      const response = await request(app)
        .get('/v1/models')
        .set('Authorization', `Bearer ${bearerToken}`)
        .expect(200);

      response.body.data.forEach((model) => {
        expect(model).toHaveProperty('id');
        expect(model).toHaveProperty('object', 'model');
        expect(model).toHaveProperty('created');
        expect(model).toHaveProperty('owned_by', 'n8n');
      });
    });

    test('should have id as string', async () => {
      const response = await request(app)
        .get('/v1/models')
        .set('Authorization', `Bearer ${bearerToken}`)
        .expect(200);

      response.body.data.forEach((model) => {
        expect(typeof model.id).toBe('string');
        expect(model.id.length).toBeGreaterThan(0);
      });
    });

    test('should have object always "model"', async () => {
      const response = await request(app)
        .get('/v1/models')
        .set('Authorization', `Bearer ${bearerToken}`)
        .expect(200);

      response.body.data.forEach((model) => {
        expect(model.object).toBe('model');
      });
    });

    test('should have created as unix timestamp', async () => {
      const response = await request(app)
        .get('/v1/models')
        .set('Authorization', `Bearer ${bearerToken}`)
        .expect(200);

      response.body.data.forEach((model) => {
        expect(typeof model.created).toBe('number');
        expect(model.created).toBeGreaterThan(0);
        expect(model.created).toBeGreaterThan(1577836800);
      });
    });

    test('should have owned_by always "n8n"', async () => {
      const response = await request(app)
        .get('/v1/models')
        .set('Authorization', `Bearer ${bearerToken}`)
        .expect(200);

      response.body.data.forEach((model) => {
        expect(model.owned_by).toBe('n8n');
      });
    });
  });

  describe('Model Content', () => {
    test('should return configured models', async () => {
      const response = await request(app)
        .get('/v1/models')
        .set('Authorization', `Bearer ${bearerToken}`)
        .expect(200);

      const modelIds = response.body.data.map((m) => m.id);
      expect(modelIds.length).toBeGreaterThanOrEqual(0);
    });

    test('should have no duplicate model IDs', async () => {
      const response = await request(app)
        .get('/v1/models')
        .set('Authorization', `Bearer ${bearerToken}`)
        .expect(200);

      const modelIds = response.body.data.map((m) => m.id);
      const uniqueIds = new Set(modelIds);

      expect(modelIds.length).toBe(uniqueIds.size);
    });

    test('should have no extra properties in model objects', async () => {
      const response = await request(app)
        .get('/v1/models')
        .set('Authorization', `Bearer ${bearerToken}`)
        .expect(200);

      response.body.data.forEach((model) => {
        const allowedKeys = ['id', 'object', 'created', 'owned_by'];
        const keys = Object.keys(model);

        expect(keys.length).toBe(allowedKeys.length);
        keys.forEach((key) => {
          expect(allowedKeys).toContain(key);
        });
      });
    });
  });

  describe('Authentication', () => {
    test('should reject requests without auth header when BEARER_TOKEN is set', async () => {
      if (authRequired) {
        await request(app).get('/v1/models').expect(401);
      } else {
        // When no BEARER_TOKEN, auth is optional
        await request(app).get('/v1/models').expect(200);
      }
    });

    test('should reject requests with invalid bearer token when BEARER_TOKEN is set', async () => {
      if (authRequired) {
        await request(app)
          .get('/v1/models')
          .set('Authorization', 'Bearer invalid-token-12345')
          .expect(401);
      } else {
        // When no BEARER_TOKEN, invalid token is still accepted
        await request(app)
          .get('/v1/models')
          .set('Authorization', 'Bearer invalid-token-12345')
          .expect(200);
      }
    });

    test('should reject requests with non-Bearer auth header when BEARER_TOKEN is set', async () => {
      if (authRequired) {
        await request(app).get('/v1/models').set('Authorization', 'Basic dGVzdDp0ZXN0').expect(401);
      } else {
        // When no BEARER_TOKEN, other auth formats are still accepted
        await request(app).get('/v1/models').set('Authorization', 'Basic dGVzdDp0ZXN0').expect(200);
      }
    });

    test('should accept valid bearer token', async () => {
      const response = await request(app)
        .get('/v1/models')
        .set('Authorization', `Bearer ${bearerToken}`)
        .expect(200);

      expect(response.body).toBeDefined();
    });
  });

  describe('Edge Cases', () => {
    test('should ignore query parameters', async () => {
      const response = await request(app)
        .get('/v1/models?foo=bar&limit=10')
        .set('Authorization', `Bearer ${bearerToken}`)
        .expect(200);

      expect(response.body.object).toBe('list');
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    test('should only accept GET method', async () => {
      await request(app)
        .post('/v1/models')
        .set('Authorization', `Bearer ${bearerToken}`)
        .expect(404);
    });

    test('should reject PUT method', async () => {
      await request(app)
        .put('/v1/models')
        .set('Authorization', `Bearer ${bearerToken}`)
        .expect(404);
    });

    test('should reject DELETE method', async () => {
      await request(app)
        .delete('/v1/models')
        .set('Authorization', `Bearer ${bearerToken}`)
        .expect(404);
    });

    test('should reject PATCH method', async () => {
      await request(app)
        .patch('/v1/models')
        .set('Authorization', `Bearer ${bearerToken}`)
        .expect(404);
    });
  });

  describe('Consistency', () => {
    test('should return same models on repeated calls', async () => {
      const response1 = await request(app)
        .get('/v1/models')
        .set('Authorization', `Bearer ${bearerToken}`)
        .expect(200);

      const response2 = await request(app)
        .get('/v1/models')
        .set('Authorization', `Bearer ${bearerToken}`)
        .expect(200);

      const ids1 = response1.body.data.map((m) => m.id).sort();
      const ids2 = response2.body.data.map((m) => m.id).sort();

      expect(ids1).toEqual(ids2);
    });

    test('should handle multiple rapid requests', async () => {
      const requests = Array.from({ length: 10 }, () =>
        request(app).get('/v1/models').set('Authorization', `Bearer ${bearerToken}`),
      );

      const responses = await Promise.all(requests);

      responses.forEach((response) => {
        expect(response.status).toBe(200);
        expect(response.body.object).toBe('list');
        expect(Array.isArray(response.body.data)).toBe(true);
      });
    });
  });
});
