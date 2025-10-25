const WebhookNotifier = require('../../src/services/webhookNotifier');
const axios = require('axios');

jest.mock('axios');

describe('WebhookNotifier', () => {
  let consoleLogSpy;
  let consoleWarnSpy;
  let consoleErrorSpy;

  beforeAll(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterAll(() => {
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    test('should be disabled when no webhook URL is provided', () => {
      const notifier = new WebhookNotifier({});
      expect(notifier.enabled).toBe(false);
    });

    test('should be enabled when webhook URL is provided', () => {
      const notifier = new WebhookNotifier({
        webhookUrl: 'https://example.com/webhook',
      });
      expect(notifier.enabled).toBe(true);
    });

    test('should use default values when not provided', () => {
      const notifier = new WebhookNotifier({
        webhookUrl: 'https://example.com/webhook',
      });
      expect(notifier.timeout).toBe(5000);
      expect(notifier.maxRetries).toBe(3);
      expect(notifier.bearerToken).toBe(null);
      expect(notifier.notifyOnStartup).toBe(false);
    });

    test('should use custom configuration values', () => {
      const notifier = new WebhookNotifier({
        webhookUrl: 'https://example.com/webhook',
        timeout: 10000,
        maxRetries: 5,
        bearerToken: 'secret-token',
        notifyOnStartup: true,
      });
      expect(notifier.timeout).toBe(10000);
      expect(notifier.maxRetries).toBe(5);
      expect(notifier.bearerToken).toBe('secret-token');
      expect(notifier.notifyOnStartup).toBe(true);
    });
  });

  describe('notify', () => {
    test('should not call webhook when disabled', async () => {
      const notifier = new WebhookNotifier({});
      const payload = { type: 'models_changed', models: {} };

      await notifier.notify(payload);

      expect(axios.post).not.toHaveBeenCalled();
    });

    test('should call webhook with correct payload and headers', async () => {
      axios.post.mockResolvedValueOnce({ status: 200 });

      const notifier = new WebhookNotifier({
        webhookUrl: 'https://example.com/webhook',
      });

      const payload = {
        type: 'models_changed',
        models: { 'model-1': 'https://n8n.example.com/webhook/1' },
      };

      await notifier.notify(payload);

      expect(axios.post).toHaveBeenCalledTimes(1);
      expect(axios.post).toHaveBeenCalledWith('https://example.com/webhook', payload, {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 5000,
      });
    });

    test('should include authorization header when bearer token provided', async () => {
      axios.post.mockResolvedValueOnce({ status: 200 });

      const notifier = new WebhookNotifier({
        webhookUrl: 'https://example.com/webhook',
        bearerToken: 'secret-token',
      });

      const payload = { type: 'models_changed', models: {} };

      await notifier.notify(payload);

      expect(axios.post).toHaveBeenCalledWith('https://example.com/webhook', payload, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer secret-token',
        },
        timeout: 5000,
      });
    });

    test('should retry on failure with exponential backoff', async () => {
      const error = new Error('Network error');
      axios.post
        .mockRejectedValueOnce(error)
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce({ status: 200 });

      const notifier = new WebhookNotifier({
        webhookUrl: 'https://example.com/webhook',
        maxRetries: 3,
      });

      const payload = { type: 'models_changed', models: {} };

      await notifier.notify(payload);

      expect(axios.post).toHaveBeenCalledTimes(3);
      expect(consoleWarnSpy).toHaveBeenCalledTimes(2);
    });

    test('should log error after max retries exceeded', async () => {
      const error = new Error('Network error');
      axios.post.mockRejectedValue(error);

      const notifier = new WebhookNotifier({
        webhookUrl: 'https://example.com/webhook',
        maxRetries: 2,
      });

      const payload = { type: 'models_changed', models: {} };

      await notifier.notify(payload);

      expect(axios.post).toHaveBeenCalledTimes(2);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Webhook notification failed after 2 attempts'),
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Webhook notification permanently failed'),
      );
    });

    test('should not throw error when all retries fail', async () => {
      const error = new Error('Network error');
      axios.post.mockRejectedValue(error);

      const notifier = new WebhookNotifier({
        webhookUrl: 'https://example.com/webhook',
        maxRetries: 2,
      });

      const payload = { type: 'models_changed', models: {} };

      // Should not throw - graceful degradation
      await expect(notifier.notify(payload)).resolves.toBeUndefined();
    });

    test('should log success message on successful notification', async () => {
      axios.post.mockResolvedValueOnce({ status: 200 });

      const notifier = new WebhookNotifier({
        webhookUrl: 'https://example.com/webhook',
      });

      const payload = { type: 'models_changed', models: {} };

      await notifier.notify(payload);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Webhook notified: https://example.com/webhook'),
      );
    });

    test('should respect custom timeout', async () => {
      axios.post.mockResolvedValueOnce({ status: 200 });

      const notifier = new WebhookNotifier({
        webhookUrl: 'https://example.com/webhook',
        timeout: 15000,
      });

      const payload = { type: 'models_changed', models: {} };

      await notifier.notify(payload);

      expect(axios.post).toHaveBeenCalledWith(
        'https://example.com/webhook',
        payload,
        expect.objectContaining({
          timeout: 15000,
        }),
      );
    });
  });

  describe('createPayload', () => {
    test('should create correct payload structure with MODELS_CHANGED', () => {
      const models = {
        'model-1': 'https://n8n.example.com/webhook/1',
        'model-2': 'https://n8n.example.com/webhook/2',
      };

      const payload = WebhookNotifier.createPayload(
        models,
        'JsonFileModelLoader',
        WebhookNotifier.EventType.MODELS_CHANGED,
      );

      expect(payload.type).toBe('models_changed');
      expect(payload.source).toBe('JsonFileModelLoader');
      expect(payload.models).toEqual(models);
      expect(payload.modelCount).toBe(2);
      expect(payload.timestamp).toBeDefined();
      expect(new Date(payload.timestamp)).toBeInstanceOf(Date);
    });

    test('should create correct payload structure with MODELS_LOADED', () => {
      const models = {
        'model-1': 'https://n8n.example.com/webhook/1',
      };

      const payload = WebhookNotifier.createPayload(
        models,
        'N8nApiModelLoader',
        WebhookNotifier.EventType.MODELS_LOADED,
      );

      expect(payload.type).toBe('models_loaded');
      expect(payload.source).toBe('N8nApiModelLoader');
      expect(payload.models).toEqual(models);
      expect(payload.modelCount).toBe(1);
    });

    test('should handle empty models object', () => {
      const payload = WebhookNotifier.createPayload(
        {},
        'N8nApiModelLoader',
        WebhookNotifier.EventType.MODELS_CHANGED,
      );

      expect(payload.modelCount).toBe(0);
      expect(payload.models).toEqual({});
    });

    test('should use current timestamp', () => {
      const beforeTime = Date.now();
      const payload = WebhookNotifier.createPayload(
        {},
        'StaticModelLoader',
        WebhookNotifier.EventType.MODELS_LOADED,
      );
      const afterTime = Date.now();

      const payloadTime = new Date(payload.timestamp).getTime();
      expect(payloadTime).toBeGreaterThanOrEqual(beforeTime - 100); // Allow small margin
      expect(payloadTime).toBeLessThanOrEqual(afterTime + 100); // Allow small margin
    });

    test('should throw error when eventType is not provided', () => {
      expect(() => {
        WebhookNotifier.createPayload({}, 'JsonFileModelLoader');
      }).toThrow('eventType is required');
    });

    test('should throw error when eventType is null', () => {
      expect(() => {
        WebhookNotifier.createPayload({}, 'JsonFileModelLoader', null);
      }).toThrow('eventType is required');
    });
  });

  describe('sleep', () => {
    test('should sleep for specified duration', async () => {
      const notifier = new WebhookNotifier({
        webhookUrl: 'https://example.com/webhook',
      });

      const startTime = Date.now();
      await notifier.sleep(100);
      const endTime = Date.now();

      const elapsed = endTime - startTime;
      expect(elapsed).toBeGreaterThanOrEqual(95); // Allow small margin
      expect(elapsed).toBeLessThan(150); // Allow small margin
    });
  });
});
