/**
 * Unit Tests: Bootstrap
 * Tests application lifecycle orchestration
 *
 * Copyright (c) 2025 Sven Eisenschmidt
 * Licensed under AGPL-3.0
 */

const Bootstrap = require('../src/Bootstrap');
const Config = require('../src/config/Config');
const ModelRepository = require('../src/repositories/ModelRepository');
const ModelLoaderFactory = require('../src/factories/ModelLoaderFactory');
const WebhookNotifierFactory = require('../src/factories/WebhookNotifierFactory');
const TaskDetectorService = require('../src/services/taskDetectorService');

// Mock console to reduce noise
global.console = {
  ...console,
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

jest.mock('../src/config/Config');
jest.mock('../src/repositories/ModelRepository');
jest.mock('../src/factories/ModelLoaderFactory');
jest.mock('../src/factories/WebhookNotifierFactory');
jest.mock('../src/services/taskDetectorService');

describe('Bootstrap', () => {
  let mockModelLoader;
  let mockWebhookNotifier;
  let mockConfig;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mock model loader
    mockModelLoader = {
      load: jest.fn().mockResolvedValue({ 'test-model': 'https://test.com' }),
      watch: jest.fn(),
      stopWatching: jest.fn(),
      constructor: { name: 'MockLoader' },
    };

    // Setup mock webhook notifier
    mockWebhookNotifier = {
      enabled: false,
      notifyOnStartup: false,
      notify: jest.fn().mockResolvedValue(),
    };

    // Setup mock config
    mockConfig = {
      enableTaskDetection: false,
    };

    Config.mockImplementation(() => mockConfig);
    ModelLoaderFactory.createModelLoader.mockReturnValue(mockModelLoader);
    WebhookNotifierFactory.createWebhookNotifier.mockReturnValue(mockWebhookNotifier);
    ModelRepository.mockImplementation(() => ({
      updateModels: jest.fn(),
      getModelCount: jest.fn().mockReturnValue(1),
    }));
  });

  describe('constructor', () => {
    test('should create core components', () => {
      const bootstrap = new Bootstrap();

      expect(bootstrap.config).toBeDefined();
      expect(bootstrap.modelRepository).toBeDefined();
      expect(bootstrap.modelLoader).toBeDefined();
      expect(bootstrap.webhookNotifier).toBeDefined();
    });

    test('should not create task detector when disabled', () => {
      mockConfig.enableTaskDetection = false;
      const bootstrap = new Bootstrap();

      expect(bootstrap.taskDetectorService).toBeNull();
    });

    test('should create task detector when enabled', () => {
      mockConfig.enableTaskDetection = true;
      TaskDetectorService.mockImplementation(() => ({
        registerDetector: jest.fn(),
      }));

      const bootstrap = new Bootstrap();

      expect(bootstrap.taskDetectorService).toBeDefined();
      expect(TaskDetectorService).toHaveBeenCalled();
    });
  });

  describe('registerBuiltInDetectors', () => {
    test('should do nothing if task detector service is null', () => {
      mockConfig.enableTaskDetection = false;
      const bootstrap = new Bootstrap();

      // Should not throw when taskDetectorService is null
      expect(() => bootstrap.registerBuiltInDetectors()).not.toThrow();
    });

    test('should register detectors from registry when task detection is enabled', () => {
      mockConfig.enableTaskDetection = true;
      const mockRegisterDetector = jest.fn();
      TaskDetectorService.mockImplementation(() => ({
        registerDetector: mockRegisterDetector,
      }));

      new Bootstrap();

      // Should have called registerDetector for each task type
      expect(mockRegisterDetector).toHaveBeenCalled();
    });
  });

  describe('initialize', () => {
    test('should load models and update repository', async () => {
      const bootstrap = new Bootstrap();
      const mockUpdateModels = jest.fn();
      bootstrap.modelRepository.updateModels = mockUpdateModels;

      await bootstrap.initialize();

      expect(mockModelLoader.load).toHaveBeenCalled();
      expect(mockUpdateModels).toHaveBeenCalledWith({ 'test-model': 'https://test.com' });
    });

    test('should setup model watcher after initialization', async () => {
      const bootstrap = new Bootstrap();

      await bootstrap.initialize();

      expect(mockModelLoader.watch).toHaveBeenCalled();
    });

    test('should notify webhook on startup if enabled', async () => {
      mockWebhookNotifier.enabled = true;
      mockWebhookNotifier.notifyOnStartup = true;

      const bootstrap = new Bootstrap();
      await bootstrap.initialize();

      expect(mockWebhookNotifier.notify).toHaveBeenCalled();
    });

    test('should warn if webhook notification on startup fails', async () => {
      mockWebhookNotifier.enabled = true;
      mockWebhookNotifier.notifyOnStartup = true;
      mockWebhookNotifier.notify.mockRejectedValue(new Error('Webhook failed'));

      const bootstrap = new Bootstrap();
      await bootstrap.initialize();

      // Should have logged warning
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('Webhook notification on startup failed'),
      );
    });

    test('should propagate model loading errors', async () => {
      mockModelLoader.load.mockRejectedValue(new Error('Load failed'));

      const bootstrap = new Bootstrap();

      await expect(bootstrap.initialize()).rejects.toThrow('Load failed');
      expect(console.error).toHaveBeenCalledWith('Failed to load models:', 'Load failed');
    });
  });

  describe('setupModelWatcher', () => {
    test('should update models when watcher triggers', async () => {
      const bootstrap = new Bootstrap();
      const mockUpdateModels = jest.fn();
      bootstrap.modelRepository.updateModels = mockUpdateModels;

      await bootstrap.initialize();

      // Get the watch callback
      const watchCallback = mockModelLoader.watch.mock.calls[0][0];
      const newModels = { 'new-model': 'https://new.com' };

      // Trigger the watch callback
      watchCallback(newModels);

      expect(mockUpdateModels).toHaveBeenCalledWith(newModels);
      expect(console.log).toHaveBeenCalledWith('Models changed, reloading...');
    });

    test('should notify webhook when models change', async () => {
      mockWebhookNotifier.enabled = true;
      const bootstrap = new Bootstrap();

      await bootstrap.initialize();

      // Get the watch callback
      const watchCallback = mockModelLoader.watch.mock.calls[0][0];
      const newModels = { 'new-model': 'https://new.com' };

      // Trigger the watch callback
      watchCallback(newModels);

      expect(mockWebhookNotifier.notify).toHaveBeenCalled();
    });

    test('should warn if webhook notification on model change fails', async () => {
      mockWebhookNotifier.enabled = true;
      mockWebhookNotifier.notify.mockRejectedValue(new Error('Webhook failed'));

      const bootstrap = new Bootstrap();
      await bootstrap.initialize();

      // Get the watch callback
      const watchCallback = mockModelLoader.watch.mock.calls[0][0];
      const newModels = { 'new-model': 'https://new.com' };

      // Trigger the watch callback
      await watchCallback(newModels);

      // Give promise time to resolve
      await new Promise((resolve) => setImmediate(resolve));

      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('Webhook notification on model change failed'),
      );
    });
  });

  describe('close', () => {
    test('should stop model loader watching', () => {
      const bootstrap = new Bootstrap();

      bootstrap.close();

      expect(mockModelLoader.stopWatching).toHaveBeenCalled();
    });

    test('should handle missing model loader gracefully', () => {
      const bootstrap = new Bootstrap();
      bootstrap.modelLoader = null;

      expect(() => bootstrap.close()).not.toThrow();
    });
  });
});
