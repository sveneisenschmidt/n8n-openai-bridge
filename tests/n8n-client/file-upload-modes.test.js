/**
 * Integration Tests: File Upload Modes
 * Tests n8nClient payload building with different file upload modes
 *
 * Copyright (c) 2025 Sven Eisenschmidt
 * Licensed under AGPL-3.0
 */

const { createTestClient } = require('../helpers/test-client');

// Mock console methods
global.console = {
  ...console,
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

describe('N8nClient - File Upload Modes', () => {
  // Sample base64 PNG (1x1 transparent pixel)
  const sampleBase64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  const sampleDataUrl = `data:image/png;base64,${sampleBase64}`;

  const multimodalMessage = {
    role: 'user',
    content: [
      { type: 'text', text: 'What is in this image?' },
      { type: 'image_url', image_url: { url: sampleDataUrl } },
    ],
  };

  const simpleMessage = { role: 'user', content: 'Hello' };
  const systemMessage = { role: 'system', content: 'You are a helpful assistant' };

  const userContext = { userId: 'test-user' };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('passthrough mode', () => {
    let client;

    beforeEach(() => {
      client = createTestClient({ fileUploadMode: 'passthrough' });
    });

    test('should preserve multimodal content as-is', () => {
      const messages = [multimodalMessage];
      const payload = client.buildPayload(messages, 'session-123', userContext);

      // Messages should be unchanged
      expect(payload.messages[0].content).toEqual(multimodalMessage.content);
      expect(payload.files).toBeUndefined();
    });

    test('should extract text for currentMessage', () => {
      const messages = [multimodalMessage];
      const payload = client.buildPayload(messages, 'session-123', userContext);

      expect(payload.currentMessage).toBe('What is in this image?');
      expect(payload.chatInput).toBe('What is in this image?');
    });

    test('should handle simple messages normally', () => {
      const messages = [simpleMessage];
      const payload = client.buildPayload(messages, 'session-123', userContext);

      expect(payload.messages[0].content).toBe('Hello');
      expect(payload.currentMessage).toBe('Hello');
    });
  });

  describe('extract-json mode', () => {
    let client;

    beforeEach(() => {
      client = createTestClient({ fileUploadMode: 'extract-json' });
    });

    test('should extract files to separate array', () => {
      const messages = [multimodalMessage];
      const payload = client.buildPayload(messages, 'session-123', userContext);

      expect(payload.files).toHaveLength(1);
      expect(payload.files[0]).toEqual({
        name: 'message_0_file_0.png',
        mimeType: 'image/png',
        data: sampleBase64,
      });
    });

    test('should replace message content with text only', () => {
      const messages = [multimodalMessage];
      const payload = client.buildPayload(messages, 'session-123', userContext);

      expect(payload.messages[0].content).toBe('What is in this image?');
    });

    test('should not include files array when no files present', () => {
      const messages = [simpleMessage];
      const payload = client.buildPayload(messages, 'session-123', userContext);

      expect(payload.files).toBeUndefined();
    });

    test('should handle multiple files across messages', () => {
      const messages = [
        multimodalMessage,
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Another image' },
            { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,abc123' } },
          ],
        },
      ];
      const payload = client.buildPayload(messages, 'session-123', userContext);

      expect(payload.files).toHaveLength(2);
      expect(payload.files[0].name).toBe('message_0_file_0.png');
      expect(payload.files[1].name).toBe('message_1_file_0.jpg');
    });
  });

  describe('extract-multipart mode', () => {
    let client;

    beforeEach(() => {
      client = createTestClient({ fileUploadMode: 'extract-multipart' });
    });

    test('should store files for multipart upload', () => {
      const messages = [multimodalMessage];
      const payload = client.buildPayload(messages, 'session-123', userContext);

      // Files should NOT be in payload (they go in multipart form)
      expect(payload.files).toBeUndefined();

      // But should be stored in _pendingFiles
      expect(client._pendingFiles).toHaveLength(1);
      expect(client._pendingFiles[0].name).toBe('message_0_file_0.png');
    });

    test('should replace message content with text only', () => {
      const messages = [multimodalMessage];
      const payload = client.buildPayload(messages, 'session-123', userContext);

      expect(payload.messages[0].content).toBe('What is in this image?');
    });
  });

  describe('disabled mode', () => {
    let client;

    beforeEach(() => {
      client = createTestClient({ fileUploadMode: 'disabled' });
    });

    test('should strip files and keep only text', () => {
      const messages = [multimodalMessage];
      const payload = client.buildPayload(messages, 'session-123', userContext);

      expect(payload.messages[0].content).toBe('What is in this image?');
      expect(payload.files).toBeUndefined();
      expect(client._pendingFiles).toHaveLength(0);
    });

    test('should handle message with only image (empty text)', () => {
      const imageOnlyMessage = {
        role: 'user',
        content: [{ type: 'image_url', image_url: { url: sampleDataUrl } }],
      };
      const messages = [imageOnlyMessage];
      const payload = client.buildPayload(messages, 'session-123', userContext);

      expect(payload.messages[0].content).toBe('');
      expect(payload.currentMessage).toBe('');
    });
  });

  describe('system message handling', () => {
    test('should extract text from multimodal system message', () => {
      const multimodalSystem = {
        role: 'system',
        content: [
          { type: 'text', text: 'You are a vision assistant' },
          { type: 'image_url', image_url: { url: sampleDataUrl } },
        ],
      };
      const client = createTestClient({ fileUploadMode: 'extract-json' });
      const messages = [multimodalSystem, simpleMessage];
      const payload = client.buildPayload(messages, 'session-123', userContext);

      expect(payload.systemPrompt).toBe('You are a vision assistant');
    });

    test('should handle simple system message normally', () => {
      const client = createTestClient({ fileUploadMode: 'passthrough' });
      const messages = [systemMessage, simpleMessage];
      const payload = client.buildPayload(messages, 'session-123', userContext);

      expect(payload.systemPrompt).toBe('You are a helpful assistant');
    });
  });

  describe('mixed content', () => {
    test('should handle mix of simple and multimodal messages', () => {
      const client = createTestClient({ fileUploadMode: 'extract-json' });
      const messages = [systemMessage, simpleMessage, multimodalMessage];
      const payload = client.buildPayload(messages, 'session-123', userContext);

      expect(payload.systemPrompt).toBe('You are a helpful assistant');
      expect(payload.messages).toHaveLength(2); // Excludes system
      expect(payload.messages[0].content).toBe('Hello');
      expect(payload.messages[1].content).toBe('What is in this image?');
      expect(payload.files).toHaveLength(1);
    });
  });
});
