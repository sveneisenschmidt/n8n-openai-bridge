const fs = require('fs');
const path = require('path');

// Mock console methods to reduce noise in test output
global.console = {
  ...console,
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

describe('Config', () => {
  let Config;
  let originalEnv;
  let tempConfigPath;
  let mockWatcher;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };

    // Create temporary models.json for testing
    tempConfigPath = path.join(__dirname, 'test-models.json');
    const testModels = {
      'test-model': 'https://n8n.example.com/webhook/test/chat',
      'another-model': 'https://n8n.example.com/webhook/another/chat'
    };
    fs.writeFileSync(tempConfigPath, JSON.stringify(testModels, null, 2));

    // Set test environment
    process.env.MODELS_CONFIG = tempConfigPath;
    process.env.PORT = '3333';
    process.env.BEARER_TOKEN = 'test-token';
    process.env.LOG_REQUESTS = 'false';

    // Mock fs.watch to prevent file watching in tests
    // Must be done BEFORE requiring the config
    mockWatcher = {
      close: jest.fn(),
      on: jest.fn(),
      removeAllListeners: jest.fn()
    };
    jest.spyOn(fs, 'watch').mockReturnValue(mockWatcher);

    // Clear module cache to get fresh instance
    jest.resetModules();
    Config = require('../src/config');
  });

  afterEach(() => {
    // Close watcher if it exists
    if (Config && Config.close) {
      Config.close();
    }

    // Restore original environment
    process.env = originalEnv;

    // Restore fs.watch
    if (fs.watch.mockRestore) {
      fs.watch.mockRestore();
    }

    // Clean up temp file
    if (fs.existsSync(tempConfigPath)) {
      fs.unlinkSync(tempConfigPath);
    }

    // Clear all mocks
    jest.clearAllMocks();
  });

  afterAll(() => {
    // Final cleanup - close any remaining watchers
    if (Config && Config.close) {
      Config.close();
    }
  });

  describe('Constructor and Basic Properties', () => {
    test('should load configuration from environment variables', () => {
      expect(Config.port).toBe('3333');
      expect(Config.bearerToken).toBe('test-token');
      expect(Config.logRequests).toBe(false);
    });

    test('should use default values when env vars are not set', () => {
      process.env = { MODELS_CONFIG: tempConfigPath };
      jest.resetModules();
      const config = require('../src/config');

      expect(config.port).toBe(3333);
      expect(config.bearerToken).toBe('');
      expect(config.logRequests).toBe(false);
    });
  });

  describe('parseSessionIdHeaders', () => {
    test('should parse comma-separated session ID headers', () => {
      process.env.SESSION_ID_HEADERS = 'X-Custom-Session,X-Chat-ID,X-Conversation';
      jest.resetModules();
      const config = require('../src/config');

      expect(config.sessionIdHeaders).toEqual(['X-Custom-Session', 'X-Chat-ID', 'X-Conversation']);
    });

    test('should use default headers when env var is empty', () => {
      process.env.SESSION_ID_HEADERS = '';
      jest.resetModules();
      const config = require('../src/config');

      expect(config.sessionIdHeaders).toEqual(['X-Session-Id', 'X-Chat-Id']);
    });

    test('should trim whitespace from header names', () => {
      process.env.SESSION_ID_HEADERS = ' X-Header-1 , X-Header-2 ,  X-Header-3  ';
      jest.resetModules();
      const config = require('../src/config');

      expect(config.sessionIdHeaders).toEqual(['X-Header-1', 'X-Header-2', 'X-Header-3']);
    });
  });

  describe('parseUserIdHeaders', () => {
    test('should parse comma-separated user ID headers', () => {
      process.env.USER_ID_HEADERS = 'X-Custom-User,X-User-ID,X-OpenWebUI-User-Id';
      jest.resetModules();
      const config = require('../src/config');

      expect(config.userIdHeaders).toEqual(['X-Custom-User', 'X-User-ID', 'X-OpenWebUI-User-Id']);
    });

    test('should use default headers when env var is empty', () => {
      process.env.USER_ID_HEADERS = '';
      jest.resetModules();
      const config = require('../src/config');

      expect(config.userIdHeaders).toEqual(['X-User-Id']);
    });

    test('should trim whitespace from header names', () => {
      process.env.USER_ID_HEADERS = ' X-User-1 , X-User-2 ,  X-User-3  ';
      jest.resetModules();
      const config = require('../src/config');

      expect(config.userIdHeaders).toEqual(['X-User-1', 'X-User-2', 'X-User-3']);
    });
  });

  describe('parseUserEmailHeaders', () => {
    test('should parse comma-separated user email headers', () => {
      process.env.USER_EMAIL_HEADERS = 'X-Email,X-User-Email,X-OpenWebUI-User-Email';
      jest.resetModules();
      const config = require('../src/config');

      expect(config.userEmailHeaders).toEqual(['X-Email', 'X-User-Email', 'X-OpenWebUI-User-Email']);
    });

    test('should use default headers when env var is empty', () => {
      process.env.USER_EMAIL_HEADERS = '';
      jest.resetModules();
      const config = require('../src/config');

      expect(config.userEmailHeaders).toEqual(['X-User-Email']);
    });
  });

  describe('parseUserNameHeaders', () => {
    test('should parse comma-separated user name headers', () => {
      process.env.USER_NAME_HEADERS = 'X-Name,X-User-Name,X-OpenWebUI-User-Name';
      jest.resetModules();
      const config = require('../src/config');

      expect(config.userNameHeaders).toEqual(['X-Name', 'X-User-Name', 'X-OpenWebUI-User-Name']);
    });

    test('should use default headers when env var is empty', () => {
      process.env.USER_NAME_HEADERS = '';
      jest.resetModules();
      const config = require('../src/config');

      expect(config.userNameHeaders).toEqual(['X-User-Name']);
    });
  });

  describe('parseUserRoleHeaders', () => {
    test('should parse comma-separated user role headers', () => {
      process.env.USER_ROLE_HEADERS = 'X-Role,X-User-Role,X-OpenWebUI-User-Role';
      jest.resetModules();
      const config = require('../src/config');

      expect(config.userRoleHeaders).toEqual(['X-Role', 'X-User-Role', 'X-OpenWebUI-User-Role']);
    });

    test('should use default headers when env var is empty', () => {
      process.env.USER_ROLE_HEADERS = '';
      jest.resetModules();
      const config = require('../src/config');

      expect(config.userRoleHeaders).toEqual(['X-User-Role']);
    });
  });

  describe('loadModels', () => {
    test('should load models from JSON file', () => {
      const models = Config.models;

      expect(models).toHaveProperty('test-model');
      expect(models).toHaveProperty('another-model');
      expect(models['test-model']).toBe('https://n8n.example.com/webhook/test/chat');
    });

    test('should return empty object when file does not exist', () => {
      process.env.MODELS_CONFIG = '/nonexistent/path/models.json';
      jest.resetModules();
      const config = require('../src/config');

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
      const modelIds = models.map(m => m.id);

      expect(modelIds).toContain('test-model');
      expect(modelIds).toContain('another-model');
    });
  });

  describe('reloadModels', () => {
    test('should reload models from file', () => {
      // Modify the file
      const newModels = {
        'new-model': 'https://n8n.example.com/webhook/new/chat'
      };
      fs.writeFileSync(tempConfigPath, JSON.stringify(newModels, null, 2));

      // Reload
      Config.reloadModels();

      expect(Config.models).toHaveProperty('new-model');
      expect(Config.models).not.toHaveProperty('test-model');
    });
  });

  describe('close', () => {
    test('should close file watcher', () => {
      Config.close();
      expect(Config.watcher).toBeNull();
      expect(mockWatcher.close).toHaveBeenCalled();
    });
  });
});
