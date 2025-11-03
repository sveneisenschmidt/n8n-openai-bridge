/**
 * Unit Tests: ModelLoaderFactory
 * Tests model loader factory and registry
 *
 * Copyright (c) 2025 Sven Eisenschmidt
 * Licensed under AGPL-3.0
 */

const ModelLoaderFactory = require('../../src/factories/ModelLoaderFactory');
const JsonFileModelLoader = require('../../src/loaders/JsonFileModelLoader');
const N8nApiModelLoader = require('../../src/loaders/N8nApiModelLoader');
const JsonHttpModelLoader = require('../../src/loaders/JsonHttpModelLoader');
const StaticModelLoader = require('../../src/loaders/StaticModelLoader');

// Mock console to reduce noise
global.console = {
  ...console,
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

describe('ModelLoaderFactory', () => {
  let originalEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    jest.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('MODEL_LOADERS registry', () => {
    test('should include all loader types', () => {
      expect(ModelLoaderFactory.MODEL_LOADERS).toContain(JsonFileModelLoader);
      expect(ModelLoaderFactory.MODEL_LOADERS).toContain(N8nApiModelLoader);
      expect(ModelLoaderFactory.MODEL_LOADERS).toContain(JsonHttpModelLoader);
      expect(ModelLoaderFactory.MODEL_LOADERS).toContain(StaticModelLoader);
    });
  });

  describe('validateEnvVars', () => {
    test('should return env values for required vars', () => {
      process.env.TEST_REQUIRED = 'value1';

      class TestLoader {
        static getRequiredEnvVars() {
          return [{ name: 'TEST_REQUIRED', required: true, description: 'Test var' }];
        }
      }

      const result = ModelLoaderFactory.validateEnvVars(TestLoader);

      expect(result.TEST_REQUIRED).toBe('value1');
    });

    test('should use default value for optional vars when not set', () => {
      // Do not set TEST_OPTIONAL in env

      class TestLoader {
        static getRequiredEnvVars() {
          return [
            {
              name: 'TEST_OPTIONAL',
              required: false,
              defaultValue: 'default-value',
              description: 'Optional test var',
            },
          ];
        }
      }

      const result = ModelLoaderFactory.validateEnvVars(TestLoader);

      expect(result.TEST_OPTIONAL).toBe('default-value');
    });

    test('should throw error for missing required vars', () => {
      // Do not set REQUIRED_VAR

      class TestLoader {
        static TYPE = 'test-loader';
        static getRequiredEnvVars() {
          return [{ name: 'REQUIRED_VAR', required: true, description: 'Required var' }];
        }
      }

      process.env.MODEL_LOADER_TYPE = 'test-loader';

      expect(() => ModelLoaderFactory.validateEnvVars(TestLoader)).toThrow(
        'Missing required environment variables for MODEL_LOADER_TYPE="test-loader"',
      );
      expect(() => ModelLoaderFactory.validateEnvVars(TestLoader)).toThrow('REQUIRED_VAR');
    });

    test('should throw error listing all missing required vars', () => {
      // Do not set multiple required vars

      class TestLoader {
        static TYPE = 'test-loader';
        static getRequiredEnvVars() {
          return [
            { name: 'VAR1', required: true, description: 'First var' },
            { name: 'VAR2', required: true, description: 'Second var' },
          ];
        }
      }

      process.env.MODEL_LOADER_TYPE = 'test-loader';

      expect(() => ModelLoaderFactory.validateEnvVars(TestLoader)).toThrow('VAR1');
      expect(() => ModelLoaderFactory.validateEnvVars(TestLoader)).toThrow('VAR2');
    });

    test('should trim whitespace from env values', () => {
      process.env.TEST_VAR = '  value-with-spaces  ';

      class TestLoader {
        static getRequiredEnvVars() {
          return [{ name: 'TEST_VAR', required: true, description: 'Test var' }];
        }
      }

      const result = ModelLoaderFactory.validateEnvVars(TestLoader);

      expect(result.TEST_VAR).toBe('value-with-spaces');
    });

    test('should treat empty string as missing', () => {
      process.env.REQUIRED_VAR = '';

      class TestLoader {
        static TYPE = 'test-loader';
        static getRequiredEnvVars() {
          return [{ name: 'REQUIRED_VAR', required: true, description: 'Required var' }];
        }
      }

      process.env.MODEL_LOADER_TYPE = 'test-loader';

      expect(() => ModelLoaderFactory.validateEnvVars(TestLoader)).toThrow(
        'Missing required environment variables',
      );
    });
  });

  describe('createModelLoader', () => {
    test('should create JsonFileModelLoader by default', () => {
      delete process.env.MODEL_LOADER_TYPE;
      process.env.MODELS_CONFIG_FILE = './test-models.json';

      const loader = ModelLoaderFactory.createModelLoader();

      expect(loader).toBeInstanceOf(JsonFileModelLoader);
      expect(console.log).toHaveBeenCalledWith('Model Loader: file');
    });

    test('should create N8nApiModelLoader when type is n8n-api', () => {
      process.env.MODEL_LOADER_TYPE = 'n8n-api';
      process.env.N8N_BASE_URL = 'https://test.com';
      process.env.N8N_API_BEARER_TOKEN = 'token123';

      const loader = ModelLoaderFactory.createModelLoader();

      expect(loader).toBeInstanceOf(N8nApiModelLoader);
      expect(console.log).toHaveBeenCalledWith('Model Loader: n8n-api');
    });

    test('should create JsonHttpModelLoader when type is json-http', () => {
      process.env.MODEL_LOADER_TYPE = 'json-http';
      process.env.JSON_HTTP_ENDPOINT = 'https://api.test.com/models';

      const loader = ModelLoaderFactory.createModelLoader();

      expect(loader).toBeInstanceOf(JsonHttpModelLoader);
      expect(console.log).toHaveBeenCalledWith('Model Loader: json-http');
    });

    test('should create StaticModelLoader when type is static', () => {
      process.env.MODEL_LOADER_TYPE = 'static';
      process.env.STATIC_MODELS = '{"test":"https://test.com"}';

      const loader = ModelLoaderFactory.createModelLoader();

      expect(loader).toBeInstanceOf(StaticModelLoader);
      expect(console.log).toHaveBeenCalledWith('Model Loader: static');
    });

    test('should throw error for invalid loader type', () => {
      process.env.MODEL_LOADER_TYPE = 'invalid-type';

      expect(() => ModelLoaderFactory.createModelLoader()).toThrow(
        'Invalid MODEL_LOADER_TYPE: "invalid-type"',
      );
      expect(() => ModelLoaderFactory.createModelLoader()).toThrow('Available types:');
    });

    test('should handle case-insensitive loader type', () => {
      process.env.MODEL_LOADER_TYPE = 'FILE';
      process.env.MODELS_CONFIG_FILE = './test-models.json';

      const loader = ModelLoaderFactory.createModelLoader();

      expect(loader).toBeInstanceOf(JsonFileModelLoader);
    });

    test('should list available loader types in error message', () => {
      process.env.MODEL_LOADER_TYPE = 'unknown';

      expect(() => ModelLoaderFactory.createModelLoader()).toThrow('file');
      expect(() => ModelLoaderFactory.createModelLoader()).toThrow('n8n-api');
      expect(() => ModelLoaderFactory.createModelLoader()).toThrow('json-http');
      expect(() => ModelLoaderFactory.createModelLoader()).toThrow('static');
    });

    test('should propagate validation errors from loader', () => {
      process.env.MODEL_LOADER_TYPE = 'n8n-api';
      // Missing required N8N_BASE_URL and N8N_API_BEARER_TOKEN

      expect(() => ModelLoaderFactory.createModelLoader()).toThrow(
        'Missing required environment variables',
      );
    });
  });
});
