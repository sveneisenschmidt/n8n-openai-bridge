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

// Mock console methods to reduce noise in test output
global.console = {
  ...console,
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

describe('Config - Model Operations', () => {
  let Config;
  let originalEnv;

  beforeEach(async () => {
    originalEnv = { ...process.env };

    process.env.MODEL_LOADER_TYPE = 'static';
    process.env.STATIC_MODELS = JSON.stringify({
      'test-model': 'https://n8n.example.com/webhook/test/chat',
      'another-model': 'https://n8n.example.com/webhook/another/chat',
    });

    jest.resetModules();
    Config = require('../../src/config');
    await Config.loadingPromise;
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.clearAllMocks();
  });

  describe('Model Loading', () => {
    test('should load models from StaticModelLoader', () => {
      const models = Config.models;

      expect(models).toHaveProperty('test-model');
      expect(models).toHaveProperty('another-model');
      expect(models['test-model']).toBe('https://n8n.example.com/webhook/test/chat');
    });

    test('should return empty object when no static models provided', async () => {
      process.env.MODEL_LOADER_TYPE = 'static';
      process.env.STATIC_MODELS = '{}';
      jest.resetModules();
      const config = require('../../src/config');
      await config.loadingPromise;

      expect(config.models).toEqual({});
    });
  });

  describe('getModelWebhookUrl', () => {
    test('should return webhook URL for existing model', () => {
      const url = Config.getModelWebhookUrl('test-model');
      expect(url).toBe('https://n8n.example.com/webhook/test/chat');
    });

    test('should return undefined for non-existent model', () => {
      const url = Config.getModelWebhookUrl('nonexistent-model');
      expect(url).toBeUndefined();
    });
  });

  describe('getAllModels', () => {
    test('should return array of model objects', () => {
      const models = Config.getAllModels();

      expect(Array.isArray(models)).toBe(true);
      expect(models.length).toBe(2);
      expect(models[0]).toHaveProperty('id');
      expect(models[0]).toHaveProperty('object', 'model');
      expect(models[0]).toHaveProperty('owned_by', 'n8n');
      expect(models[0]).toHaveProperty('created');
    });

    test('should include all configured models', () => {
      const models = Config.getAllModels();
      const modelIds = models.map((m) => m.id);

      expect(modelIds).toContain('test-model');
      expect(modelIds).toContain('another-model');
    });

    test('should return empty array when no models', async () => {
      process.env.MODEL_LOADER_TYPE = 'static';
      process.env.STATIC_MODELS = '{}';
      jest.resetModules();
      const config = require('../../src/config');
      await config.loadingPromise;

      const models = config.getAllModels();
      expect(models).toEqual([]);
    });
  });

  describe('reloadModels', () => {
    test('should reload models from loader', async () => {
      // Note: StaticModelLoader doesn't change models on reload,
      // but this tests the interface
      const initialModels = { ...Config.models };
      await Config.reloadModels();

      expect(Config.models).toEqual(initialModels);
    });
  });

  describe('close', () => {
    test('should call stopWatching on model loader if available', () => {
      const stopWatchingSpy = jest.spyOn(Config.modelLoader, 'stopWatching');
      Config.close();
      expect(stopWatchingSpy).toHaveBeenCalled();
    });
  });
});
