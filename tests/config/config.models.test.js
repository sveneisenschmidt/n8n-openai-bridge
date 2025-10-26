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

const ModelRepository = require('../../src/repositories/ModelRepository');

// Mock console methods to reduce noise in test output
global.console = {
  ...console,
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

describe('ModelRepository - Model Operations', () => {
  let modelRepository;

  beforeEach(() => {
    modelRepository = new ModelRepository();
  });

  describe('Model Loading', () => {
    test('should store models', () => {
      modelRepository.models = {
        'test-model': 'https://n8n.example.com/webhook/test/chat',
        'another-model': 'https://n8n.example.com/webhook/another/chat',
      };

      expect(modelRepository.models).toHaveProperty('test-model');
      expect(modelRepository.models).toHaveProperty('another-model');
      expect(modelRepository.models['test-model']).toBe(
        'https://n8n.example.com/webhook/test/chat',
      );
    });

    test('should start with empty object', () => {
      expect(modelRepository.models).toEqual({});
    });
  });

  describe('getModelWebhookUrl', () => {
    beforeEach(() => {
      modelRepository.models = {
        'test-model': 'https://n8n.example.com/webhook/test/chat',
        'another-model': 'https://n8n.example.com/webhook/another/chat',
      };
    });

    test('should return webhook URL for existing model', () => {
      const url = modelRepository.getModelWebhookUrl('test-model');
      expect(url).toBe('https://n8n.example.com/webhook/test/chat');
    });

    test('should return undefined for non-existent model', () => {
      const url = modelRepository.getModelWebhookUrl('nonexistent-model');
      expect(url).toBeUndefined();
    });
  });

  describe('getAllModels', () => {
    test('should return array of model objects', () => {
      modelRepository.models = {
        'test-model': 'https://n8n.example.com/webhook/test/chat',
        'another-model': 'https://n8n.example.com/webhook/another/chat',
      };

      const models = modelRepository.getAllModels();

      expect(Array.isArray(models)).toBe(true);
      expect(models.length).toBe(2);
      expect(models[0]).toHaveProperty('id');
      expect(models[0]).toHaveProperty('object', 'model');
      expect(models[0]).toHaveProperty('owned_by', 'n8n');
      expect(models[0]).toHaveProperty('created');
    });

    test('should include all configured models', () => {
      modelRepository.models = {
        'test-model': 'https://n8n.example.com/webhook/test/chat',
        'another-model': 'https://n8n.example.com/webhook/another/chat',
      };

      const models = modelRepository.getAllModels();
      const modelIds = models.map((m) => m.id);

      expect(modelIds).toContain('test-model');
      expect(modelIds).toContain('another-model');
    });

    test('should return empty array when no models', () => {
      modelRepository.models = {};

      const models = modelRepository.getAllModels();
      expect(models).toEqual([]);
    });
  });

  describe('reloadModels', () => {
    test('should reload models from loader', async () => {
      const mockLoader = {
        load: jest.fn().mockResolvedValue({
          'new-model': 'https://n8n.example.com/webhook/new',
        }),
      };

      const newModels = await modelRepository.reloadModels(mockLoader);

      expect(mockLoader.load).toHaveBeenCalled();
      expect(modelRepository.models).toEqual({
        'new-model': 'https://n8n.example.com/webhook/new',
      });
      expect(newModels).toEqual({
        'new-model': 'https://n8n.example.com/webhook/new',
      });
    });
  });

  describe('updateModels', () => {
    test('should update models', () => {
      modelRepository.updateModels({
        'updated-model': 'https://n8n.example.com/webhook/updated',
      });

      expect(modelRepository.models).toEqual({
        'updated-model': 'https://n8n.example.com/webhook/updated',
      });
    });
  });

  describe('getModelCount', () => {
    test('should return count of models', () => {
      modelRepository.models = {
        'model-1': 'url1',
        'model-2': 'url2',
        'model-3': 'url3',
      };

      expect(modelRepository.getModelCount()).toBe(3);
    });

    test('should return 0 for empty models', () => {
      expect(modelRepository.getModelCount()).toBe(0);
    });
  });

  describe('hasModel', () => {
    beforeEach(() => {
      modelRepository.models = {
        'test-model': 'https://n8n.example.com/webhook/test',
      };
    });

    test('should return true for existing model', () => {
      expect(modelRepository.hasModel('test-model')).toBe(true);
    });

    test('should return false for non-existent model', () => {
      expect(modelRepository.hasModel('nonexistent')).toBe(false);
    });
  });
});
