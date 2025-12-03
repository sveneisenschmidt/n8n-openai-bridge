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

const {
  isMultimodalMessage,
  parseDataUrl,
  getExtensionFromMimeType,
  extractTextFromMultimodal,
  extractFilesFromMultimodal,
  processMessages,
  filesToBuffers,
} = require('../../src/services/fileProcessorService');

describe('FileProcessorService', () => {
  // Sample base64 PNG (1x1 transparent pixel)
  const sampleBase64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  const sampleDataUrl = `data:image/png;base64,${sampleBase64}`;

  describe('isMultimodalMessage', () => {
    test('should return true for message with array content', () => {
      const message = {
        role: 'user',
        content: [
          { type: 'text', text: 'Hello' },
          { type: 'image_url', image_url: { url: sampleDataUrl } },
        ],
      };
      expect(isMultimodalMessage(message)).toBe(true);
    });

    test('should return false for message with string content', () => {
      const message = { role: 'user', content: 'Hello' };
      expect(isMultimodalMessage(message)).toBe(false);
    });

    test('should return false for message with null content', () => {
      const message = { role: 'user', content: null };
      expect(isMultimodalMessage(message)).toBe(false);
    });

    test('should return false for message with undefined content', () => {
      const message = { role: 'user' };
      expect(isMultimodalMessage(message)).toBe(false);
    });
  });

  describe('parseDataUrl', () => {
    test('should parse valid data URL', () => {
      const result = parseDataUrl(sampleDataUrl);
      expect(result).toEqual({
        mimeType: 'image/png',
        data: sampleBase64,
      });
    });

    test('should parse JPEG data URL', () => {
      const jpegUrl = 'data:image/jpeg;base64,/9j/4AAQSkZJRg==';
      const result = parseDataUrl(jpegUrl);
      expect(result).toEqual({
        mimeType: 'image/jpeg',
        data: '/9j/4AAQSkZJRg==',
      });
    });

    test('should return null for regular URL', () => {
      const result = parseDataUrl('https://example.com/image.png');
      expect(result).toBeNull();
    });

    test('should return null for null input', () => {
      expect(parseDataUrl(null)).toBeNull();
    });

    test('should return null for undefined input', () => {
      expect(parseDataUrl(undefined)).toBeNull();
    });

    test('should return null for non-string input', () => {
      expect(parseDataUrl(123)).toBeNull();
    });

    test('should return null for malformed data URL', () => {
      expect(parseDataUrl('data:image/png;')).toBeNull();
    });
  });

  describe('getExtensionFromMimeType', () => {
    test('should return png for image/png', () => {
      expect(getExtensionFromMimeType('image/png')).toBe('png');
    });

    test('should return jpg for image/jpeg', () => {
      expect(getExtensionFromMimeType('image/jpeg')).toBe('jpg');
    });

    test('should return jpg for image/jpg', () => {
      expect(getExtensionFromMimeType('image/jpg')).toBe('jpg');
    });

    test('should return gif for image/gif', () => {
      expect(getExtensionFromMimeType('image/gif')).toBe('gif');
    });

    test('should return webp for image/webp', () => {
      expect(getExtensionFromMimeType('image/webp')).toBe('webp');
    });

    test('should return svg for image/svg+xml', () => {
      expect(getExtensionFromMimeType('image/svg+xml')).toBe('svg');
    });

    test('should return pdf for application/pdf', () => {
      expect(getExtensionFromMimeType('application/pdf')).toBe('pdf');
    });

    test('should return bin for unknown mime type', () => {
      expect(getExtensionFromMimeType('application/unknown')).toBe('bin');
    });
  });

  describe('extractTextFromMultimodal', () => {
    test('should extract text from multimodal message', () => {
      const message = {
        role: 'user',
        content: [
          { type: 'text', text: 'What is in this image?' },
          { type: 'image_url', image_url: { url: sampleDataUrl } },
        ],
      };
      expect(extractTextFromMultimodal(message)).toBe('What is in this image?');
    });

    test('should combine multiple text parts', () => {
      const message = {
        role: 'user',
        content: [
          { type: 'text', text: 'First line' },
          { type: 'image_url', image_url: { url: sampleDataUrl } },
          { type: 'text', text: 'Second line' },
        ],
      };
      expect(extractTextFromMultimodal(message)).toBe('First line\nSecond line');
    });

    test('should return empty string for no text parts', () => {
      const message = {
        role: 'user',
        content: [{ type: 'image_url', image_url: { url: sampleDataUrl } }],
      };
      expect(extractTextFromMultimodal(message)).toBe('');
    });

    test('should return content for non-multimodal message', () => {
      const message = { role: 'user', content: 'Hello' };
      expect(extractTextFromMultimodal(message)).toBe('Hello');
    });

    test('should return empty string for message without content', () => {
      const message = { role: 'user' };
      expect(extractTextFromMultimodal(message)).toBe('');
    });
  });

  describe('extractFilesFromMultimodal', () => {
    test('should extract files from multimodal message', () => {
      const message = {
        role: 'user',
        content: [
          { type: 'text', text: 'What is this?' },
          { type: 'image_url', image_url: { url: sampleDataUrl } },
        ],
      };
      const files = extractFilesFromMultimodal(message, 0);
      expect(files).toHaveLength(1);
      expect(files[0]).toEqual({
        name: 'message_0_file_0.png',
        mimeType: 'image/png',
        data: sampleBase64,
      });
    });

    test('should extract multiple files', () => {
      const message = {
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: sampleDataUrl } },
          { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,abc123' } },
        ],
      };
      const files = extractFilesFromMultimodal(message, 2);
      expect(files).toHaveLength(2);
      expect(files[0].name).toBe('message_2_file_0.png');
      expect(files[1].name).toBe('message_2_file_1.jpg');
    });

    test('should ignore non-data URLs', () => {
      const message = {
        role: 'user',
        content: [{ type: 'image_url', image_url: { url: 'https://example.com/image.png' } }],
      };
      const files = extractFilesFromMultimodal(message, 0);
      expect(files).toHaveLength(0);
    });

    test('should return empty array for non-multimodal message', () => {
      const message = { role: 'user', content: 'Hello' };
      const files = extractFilesFromMultimodal(message, 0);
      expect(files).toHaveLength(0);
    });

    test('should handle missing image_url field', () => {
      const message = {
        role: 'user',
        content: [{ type: 'image_url' }],
      };
      const files = extractFilesFromMultimodal(message, 0);
      expect(files).toHaveLength(0);
    });
  });

  describe('processMessages', () => {
    const multimodalMessage = {
      role: 'user',
      content: [
        { type: 'text', text: 'Describe this image' },
        { type: 'image_url', image_url: { url: sampleDataUrl } },
      ],
    };

    const simpleMessage = { role: 'user', content: 'Hello' };

    describe('passthrough mode', () => {
      test('should return messages unchanged', () => {
        const messages = [simpleMessage, multimodalMessage];
        const result = processMessages(messages, 'passthrough');
        expect(result.messages).toBe(messages);
        expect(result.files).toHaveLength(0);
      });
    });

    describe('disabled mode', () => {
      test('should strip files and keep only text', () => {
        const messages = [multimodalMessage];
        const result = processMessages(messages, 'disabled');
        expect(result.messages[0].content).toBe('Describe this image');
        expect(result.files).toHaveLength(0);
      });

      test('should preserve simple messages', () => {
        const messages = [simpleMessage];
        const result = processMessages(messages, 'disabled');
        expect(result.messages[0]).toEqual(simpleMessage);
      });
    });

    describe('extract-json mode', () => {
      test('should extract files to separate array', () => {
        const messages = [multimodalMessage];
        const result = processMessages(messages, 'extract-json');
        expect(result.messages[0].content).toBe('Describe this image');
        expect(result.files).toHaveLength(1);
        expect(result.files[0].name).toBe('message_0_file_0.png');
        expect(result.files[0].data).toBe(sampleBase64);
      });

      test('should handle multiple messages with files', () => {
        const messages = [
          simpleMessage,
          multimodalMessage,
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Another image' },
              { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,xyz789' } },
            ],
          },
        ];
        const result = processMessages(messages, 'extract-json');
        expect(result.files).toHaveLength(2);
        expect(result.files[0].name).toBe('message_1_file_0.png');
        expect(result.files[1].name).toBe('message_2_file_0.jpg');
      });
    });

    describe('extract-multipart mode', () => {
      test('should extract files same as extract-json', () => {
        const messages = [multimodalMessage];
        const result = processMessages(messages, 'extract-multipart');
        expect(result.messages[0].content).toBe('Describe this image');
        expect(result.files).toHaveLength(1);
        expect(result.files[0].name).toBe('message_0_file_0.png');
      });
    });
  });

  describe('filesToBuffers', () => {
    test('should convert base64 data to Buffers', () => {
      const files = [{ name: 'test.png', mimeType: 'image/png', data: sampleBase64 }];
      const result = filesToBuffers(files);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('test.png');
      expect(result[0].mimeType).toBe('image/png');
      expect(Buffer.isBuffer(result[0].buffer)).toBe(true);
    });

    test('should handle multiple files', () => {
      const files = [
        { name: 'a.png', mimeType: 'image/png', data: 'YWJj' },
        { name: 'b.jpg', mimeType: 'image/jpeg', data: 'eHl6' },
      ];
      const result = filesToBuffers(files);
      expect(result).toHaveLength(2);
      expect(result[0].buffer.toString()).toBe('abc');
      expect(result[1].buffer.toString()).toBe('xyz');
    });

    test('should return empty array for empty input', () => {
      expect(filesToBuffers([])).toHaveLength(0);
    });
  });
});
