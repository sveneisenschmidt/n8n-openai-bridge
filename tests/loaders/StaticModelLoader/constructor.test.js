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

describe('StaticModelLoader - Constructor', () => {
  test('should parse STATIC_MODELS from JSON string', () => {
    const modelsJson = JSON.stringify({
      'test-model': 'https://n8n.example.com/webhook/test',
      'another-model': 'https://n8n.example.com/webhook/another',
    });

    const loader = new StaticModelLoader({ STATIC_MODELS: modelsJson });

    expect(loader.staticModels).toEqual({
      'test-model': 'https://n8n.example.com/webhook/test',
      'another-model': 'https://n8n.example.com/webhook/another',
    });
  });

  test('should use empty object when STATIC_MODELS is not provided', () => {
    const loader = new StaticModelLoader({ STATIC_MODELS: '{}' });

    expect(loader.staticModels).toEqual({});
  });

  test('should throw error on invalid JSON', () => {
    expect(() => {
      new StaticModelLoader({ STATIC_MODELS: 'invalid-json' });
    }).toThrow('Invalid JSON in STATIC_MODELS');
  });
});
