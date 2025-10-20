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
const adminReloadRoute = require('../../src/routes/adminReload');

describe('adminReload route', () => {
  let app;
  let mockConfig;

  beforeEach(() => {
    // Create Express app with route
    app = express();
    app.use(express.json());

    // Mock config
    mockConfig = {
      models: {
        'model-1': 'https://n8n.example.com/webhook/1',
        'model-2': 'https://n8n.example.com/webhook/2',
      },
      reloadModels: jest.fn(),
    };

    // Store mock in app.locals
    app.locals.config = mockConfig;

    // Mount route
    app.use('/', adminReloadRoute);
  });

  describe('POST /', () => {
    it('should reload models successfully', async () => {
      mockConfig.reloadModels.mockImplementation(() => {
        mockConfig.models = {
          'model-1': 'https://n8n.example.com/webhook/1',
          'model-2': 'https://n8n.example.com/webhook/2',
          'model-3': 'https://n8n.example.com/webhook/3',
        };
      });

      const response = await request(app).post('/').send();

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        status: 'ok',
        message: 'Models reloaded',
        models: 3,
      });
      expect(mockConfig.reloadModels).toHaveBeenCalled();
    });

    it('should return current model count after reload', async () => {
      mockConfig.reloadModels.mockImplementation(() => {
        mockConfig.models = {
          'new-model': 'https://n8n.example.com/webhook/new',
        };
      });

      const response = await request(app).post('/').send();

      expect(response.status).toBe(200);
      expect(response.body.models).toBe(1);
    });

    it('should handle empty models after reload', async () => {
      mockConfig.reloadModels.mockImplementation(() => {
        mockConfig.models = {};
      });

      const response = await request(app).post('/').send();

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        status: 'ok',
        message: 'Models reloaded',
        models: 0,
      });
    });

    it('should return 500 if reload fails', async () => {
      mockConfig.reloadModels.mockImplementation(() => {
        throw new Error('Failed to read models.json');
      });

      const response = await request(app).post('/').send();

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        error: {
          message: 'Failed to read models.json',
          type: 'server_error',
        },
      });
    });

    it('should handle file system errors', async () => {
      mockConfig.reloadModels.mockImplementation(() => {
        const error = new Error('ENOENT: no such file or directory');
        error.code = 'ENOENT';
        throw error;
      });

      const response = await request(app).post('/').send();

      expect(response.status).toBe(500);
      expect(response.body.error.message).toContain('ENOENT');
    });

    it('should handle JSON parse errors', async () => {
      mockConfig.reloadModels.mockImplementation(() => {
        throw new SyntaxError('Unexpected token in JSON');
      });

      const response = await request(app).post('/').send();

      expect(response.status).toBe(500);
      expect(response.body.error.message).toContain('Unexpected token');
    });
  });
});
