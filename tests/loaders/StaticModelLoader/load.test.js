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

const StaticModelLoader = require('../../../src/loaders/StaticModelLoader');

describe('StaticModelLoader - load', () => {
  test('should return static models', async () => {
    const modelsJson = JSON.stringify({
      'model-1': 'https://n8n.example.com/webhook/1',
      'model-2': 'https://n8n.example.com/webhook/2',
    });

    const loader = new StaticModelLoader({ STATIC_MODELS: modelsJson });
    const models = await loader.load();

    expect(models).toEqual({
      'model-1': 'https://n8n.example.com/webhook/1',
      'model-2': 'https://n8n.example.com/webhook/2',
    });
  });

  test('should return empty object when no models provided', async () => {
    const loader = new StaticModelLoader({ STATIC_MODELS: '{}' });
    const models = await loader.load();

    expect(models).toEqual({});
  });

  test('should validate models through base class', async () => {
    const modelsJson = JSON.stringify({
      'valid-model': 'https://n8n.example.com/webhook/valid',
      'invalid-model': 'not-a-url',
    });

    const loader = new StaticModelLoader({ STATIC_MODELS: modelsJson });
    const models = await loader.load();

    // validateModels() should filter out invalid URLs
    expect(models).toHaveProperty('valid-model');
    expect(models).not.toHaveProperty('invalid-model');
  });
});
