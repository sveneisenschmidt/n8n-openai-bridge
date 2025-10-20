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
const healthRoute = require('../../src/routes/health');

describe('Health Route - GET /health', () => {
  let app;

  beforeEach(() => {
    // Create Express app with route
    app = express();
    app.use(express.json());

    // Mount route
    app.use('/', healthRoute);
  });

  describe('Response Structure', () => {
    test('should return 200 status', async () => {
      await request(app).get('/').expect(200);
    });

    test('should return JSON content-type', async () => {
      await request(app).get('/').expect('Content-Type', /json/);
    });

    test('should return status "ok"', async () => {
      const response = await request(app).get('/').expect(200);

      expect(response.body.status).toBe('ok');
    });

    test('should return uptime as number', async () => {
      const response = await request(app).get('/').expect(200);

      expect(typeof response.body.uptime).toBe('number');
    });

    test('should have exactly two properties', async () => {
      const response = await request(app).get('/').expect(200);

      expect(Object.keys(response.body).length).toBe(2);
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('uptime');
    });
  });

  describe('Uptime Values', () => {
    test('should return non-negative uptime', async () => {
      const response = await request(app).get('/').expect(200);

      expect(response.body.uptime).toBeGreaterThanOrEqual(0);
    });

    test('should return uptime less than 1 hour', async () => {
      const response = await request(app).get('/').expect(200);

      expect(response.body.uptime).toBeLessThan(3600);
    });

    test('should increase uptime between calls', async () => {
      const response1 = await request(app).get('/').expect(200);

      const uptime1 = response1.body.uptime;

      await new Promise((resolve) => setTimeout(resolve, 10));

      const response2 = await request(app).get('/').expect(200);

      const uptime2 = response2.body.uptime;

      expect(uptime2).toBeGreaterThanOrEqual(uptime1);
    });
  });

  describe('Consistency', () => {
    test('should consistently return "ok" status', async () => {
      for (let i = 0; i < 5; i++) {
        const response = await request(app).get('/').expect(200);

        expect(response.body.status).toBe('ok');
      }
    });

    test('should handle multiple rapid requests', async () => {
      const requests = Array.from({ length: 10 }, () => request(app).get('/'));

      const responses = await Promise.all(requests);

      responses.forEach((response) => {
        expect(response.status).toBe(200);
        expect(response.body.status).toBe('ok');
        expect(typeof response.body.uptime).toBe('number');
      });
    });
  });

  describe('HTTP Methods', () => {
    test('should only accept GET method', async () => {
      await request(app).post('/').expect(404);
    });

    test('should reject PUT method', async () => {
      await request(app).put('/').expect(404);
    });

    test('should reject DELETE method', async () => {
      await request(app).delete('/').expect(404);
    });

    test('should reject PATCH method', async () => {
      await request(app).patch('/').expect(404);
    });
  });

  describe('Query Parameters', () => {
    test('should ignore query parameters', async () => {
      const response = await request(app).get('/?foo=bar&baz=qux').expect(200);

      expect(response.body.status).toBe('ok');
    });
  });
});
