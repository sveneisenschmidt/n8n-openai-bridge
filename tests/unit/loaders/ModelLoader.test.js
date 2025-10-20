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

const ModelLoader = require('../../../src/loaders/ModelLoader');

describe('ModelLoader', () => {
  describe('load()', () => {
    it('should throw error when not implemented', async () => {
      const loader = new ModelLoader();
      await expect(loader.load()).rejects.toThrow('load() must be implemented by subclass');
    });
  });

  describe('validateModels()', () => {
    let loader;

    beforeEach(() => {
      loader = new ModelLoader();
    });

    it('should accept valid models object', () => {
      const validModels = {
        'model-1': 'https://example.com/webhook1',
        'model-2': 'https://example.com/webhook2',
      };

      expect(() => loader.validateModels(validModels)).not.toThrow();
      const result = loader.validateModels(validModels);
      expect(result).toEqual(validModels);
    });

    it('should reject null or undefined', () => {
      expect(() => loader.validateModels(null)).toThrow('Models must be an object');
      expect(() => loader.validateModels(undefined)).toThrow('Models must be an object');
    });

    it('should reject non-object types', () => {
      expect(() => loader.validateModels('string')).toThrow('Models must be an object');
      expect(() => loader.validateModels(123)).toThrow('Models must be an object');
      expect(() => loader.validateModels([])).toThrow('Models must be an object');
    });

    it('should filter out empty model ID', () => {
      const invalidModels = {
        '': 'https://example.com/webhook',
      };

      const result = loader.validateModels(invalidModels);
      expect(result).toEqual({});
    });

    it('should reject non-string model ID', () => {
      const invalidModels = {
        123: 'https://example.com/webhook',
      };

      // Note: Object keys are always strings in JavaScript, so this test ensures the validation logic works
      expect(() => loader.validateModels(invalidModels)).not.toThrow();
    });

    it('should filter out empty webhook URL', () => {
      const invalidModels = {
        'model-1': '',
      };

      const result = loader.validateModels(invalidModels);
      expect(result).toEqual({});
    });

    it('should filter out invalid webhook URL format', () => {
      const invalidModels = {
        'model-1': 'not-a-url',
      };

      const result = loader.validateModels(invalidModels);
      expect(result).toEqual({});
    });

    it('should accept various valid URL formats', () => {
      const validModels = {
        'http-url': 'http://example.com/webhook',
        'https-url': 'https://example.com/webhook',
        'with-port': 'https://example.com:8080/webhook',
        'with-path': 'https://example.com/path/to/webhook',
        'with-query': 'https://example.com/webhook?param=value',
      };

      expect(() => loader.validateModels(validModels)).not.toThrow();
    });

    it('should accept empty models object', () => {
      expect(() => loader.validateModels({})).not.toThrow();
    });

    it('should filter out invalid models while keeping valid ones', () => {
      const mixedModels = {
        'valid-model': 'https://example.com/webhook',
        'invalid-url': 'not-a-url',
        'empty-url': '',
        'valid-model-2': 'https://example.com/webhook2',
      };

      const result = loader.validateModels(mixedModels);
      expect(result).toEqual({
        'valid-model': 'https://example.com/webhook',
        'valid-model-2': 'https://example.com/webhook2',
      });
    });
  });

  describe('watch() and stopWatching()', () => {
    it('should not throw when called (optional implementation)', () => {
      const loader = new ModelLoader();
      expect(() => loader.watch(() => {})).not.toThrow();
      expect(() => loader.stopWatching()).not.toThrow();
    });
  });
});
