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
  resolveFileReferences,
  resolveAttachments,
  resolveContentParts,
  bufferToDataUrl,
} = require('../../src/utils/fileResolver');
const { getMimeTypeFromFilename } = require('../../src/utils/mimeTypes');

describe('fileResolver', () => {
  let mockFileService;
  let consoleWarnSpy;

  beforeEach(() => {
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    mockFileService = {
      getFileContent: jest.fn(),
    };
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
  });

  describe('resolveFileReferences', () => {
    it('should return messages unchanged if no file references', () => {
      const messages = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there' },
      ];

      const result = resolveFileReferences(messages, mockFileService);
      expect(result).toEqual(messages);
    });

    it('should handle null/undefined messages', () => {
      expect(resolveFileReferences(null, mockFileService)).toBeNull();
      expect(resolveFileReferences(undefined, mockFileService)).toBeUndefined();
    });

    it('should resolve attachments in messages', () => {
      const buffer = Buffer.from('pdf content');
      mockFileService.getFileContent.mockReturnValue({
        buffer,
        metadata: { filename: 'doc.pdf' },
      });

      const messages = [
        {
          role: 'user',
          content: 'Summarize this',
          attachments: [{ file_id: 'file-123' }],
        },
      ];

      const result = resolveFileReferences(messages, mockFileService);
      expect(result[0].attachments).toBeUndefined();
      expect(result[0].content).toHaveLength(2);
      expect(result[0].content[0]).toEqual({ type: 'text', text: 'Summarize this' });
      expect(result[0].content[1].type).toBe('image_url');
      expect(result[0].content[1].image_url.url).toMatch(/^data:application\/pdf;base64,/);
    });

    it('should resolve content parts with file- prefixed URLs', () => {
      const buffer = Buffer.from('image data');
      mockFileService.getFileContent.mockReturnValue({
        buffer,
        metadata: { filename: 'photo.png' },
      });

      const messages = [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'What is this?' },
            { type: 'image_url', image_url: { url: 'file-456' } },
          ],
        },
      ];

      const result = resolveFileReferences(messages, mockFileService);
      expect(result[0].content[1].image_url.url).toMatch(/^data:image\/png;base64,/);
    });

    it('should handle mixed messages', () => {
      mockFileService.getFileContent.mockReturnValue({
        buffer: Buffer.from('data'),
        metadata: { filename: 'file.txt' },
      });

      const messages = [
        { role: 'system', content: 'You are helpful' },
        {
          role: 'user',
          content: 'Check this',
          attachments: [{ file_id: 'file-1' }],
        },
        { role: 'assistant', content: 'Sure' },
      ];

      const result = resolveFileReferences(messages, mockFileService);
      expect(result[0].content).toBe('You are helpful');
      expect(result[1].content).toHaveLength(2);
      expect(result[2].content).toBe('Sure');
    });
  });

  describe('resolveAttachments', () => {
    it('should convert string content to array format', () => {
      mockFileService.getFileContent.mockReturnValue({
        buffer: Buffer.from('data'),
        metadata: { filename: 'file.txt' },
      });

      const message = {
        role: 'user',
        content: 'Hello',
        attachments: [{ file_id: 'file-1' }],
      };

      const result = resolveAttachments(message, mockFileService);
      expect(Array.isArray(result.content)).toBe(true);
      expect(result.content[0]).toEqual({ type: 'text', text: 'Hello' });
    });

    it('should handle empty string content', () => {
      mockFileService.getFileContent.mockReturnValue({
        buffer: Buffer.from('data'),
        metadata: { filename: 'file.txt' },
      });

      const message = {
        role: 'user',
        content: '',
        attachments: [{ file_id: 'file-1' }],
      };

      const result = resolveAttachments(message, mockFileService);
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('image_url');
    });

    it('should skip attachments without file_id', () => {
      const message = {
        role: 'user',
        content: 'Hello',
        attachments: [{ tools: [{ type: 'file_search' }] }],
      };

      const result = resolveAttachments(message, mockFileService);
      expect(result).toBe(message);
    });

    it('should warn and skip missing files', () => {
      mockFileService.getFileContent.mockReturnValue(null);

      const message = {
        role: 'user',
        content: 'Hello',
        attachments: [{ file_id: 'file-expired' }],
      };

      const result = resolveAttachments(message, mockFileService);
      expect(result).toBe(message);
      expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('file-expired'));
    });

    it('should handle array content with attachments', () => {
      mockFileService.getFileContent.mockReturnValue({
        buffer: Buffer.from('data'),
        metadata: { filename: 'file.txt' },
      });

      const message = {
        role: 'user',
        content: [{ type: 'text', text: 'Hello' }],
        attachments: [{ file_id: 'file-1' }],
      };

      const result = resolveAttachments(message, mockFileService);
      expect(result.content).toHaveLength(2);
    });
  });

  describe('resolveContentParts', () => {
    it('should replace file- prefixed URLs with data URLs', () => {
      mockFileService.getFileContent.mockReturnValue({
        buffer: Buffer.from('image data'),
        metadata: { filename: 'photo.jpg' },
      });

      const message = {
        role: 'user',
        content: [
          { type: 'text', text: 'Look' },
          { type: 'image_url', image_url: { url: 'file-123' } },
        ],
      };

      const result = resolveContentParts(message, mockFileService);
      expect(result.content[0]).toEqual({ type: 'text', text: 'Look' });
      expect(result.content[1].image_url.url).toMatch(/^data:image\/jpeg;base64,/);
    });

    it('should not modify non-file URLs', () => {
      const message = {
        role: 'user',
        content: [{ type: 'image_url', image_url: { url: 'https://example.com/img.png' } }],
      };

      const result = resolveContentParts(message, mockFileService);
      expect(result).toBe(message);
    });

    it('should not modify data URLs', () => {
      const message = {
        role: 'user',
        content: [{ type: 'image_url', image_url: { url: 'data:image/png;base64,abc' } }],
      };

      const result = resolveContentParts(message, mockFileService);
      expect(result).toBe(message);
    });

    it('should warn and keep original for missing files', () => {
      mockFileService.getFileContent.mockReturnValue(null);

      const message = {
        role: 'user',
        content: [{ type: 'image_url', image_url: { url: 'file-gone' } }],
      };

      const result = resolveContentParts(message, mockFileService);
      expect(result).toBe(message);
      expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('file-gone'));
    });

    it('should skip non-image_url parts', () => {
      const message = {
        role: 'user',
        content: [{ type: 'text', text: 'Hello' }],
      };

      const result = resolveContentParts(message, mockFileService);
      expect(result).toBe(message);
    });
  });

  describe('bufferToDataUrl', () => {
    it('should create data URL from buffer and filename', () => {
      const buffer = Buffer.from('test');
      const result = bufferToDataUrl(buffer, 'doc.pdf');
      expect(result).toBe(`data:application/pdf;base64,${buffer.toString('base64')}`);
    });
  });

  describe('getMimeTypeFromFilename', () => {
    it('should return correct mime types for known extensions', () => {
      expect(getMimeTypeFromFilename('photo.png')).toBe('image/png');
      expect(getMimeTypeFromFilename('photo.jpg')).toBe('image/jpeg');
      expect(getMimeTypeFromFilename('photo.jpeg')).toBe('image/jpeg');
      expect(getMimeTypeFromFilename('anim.gif')).toBe('image/gif');
      expect(getMimeTypeFromFilename('img.webp')).toBe('image/webp');
      expect(getMimeTypeFromFilename('icon.svg')).toBe('image/svg+xml');
      expect(getMimeTypeFromFilename('doc.pdf')).toBe('application/pdf');
      expect(getMimeTypeFromFilename('notes.txt')).toBe('text/plain');
      expect(getMimeTypeFromFilename('data.json')).toBe('application/json');
      expect(getMimeTypeFromFilename('doc.doc')).toBe('application/msword');
      expect(getMimeTypeFromFilename('doc.docx')).toBe(
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      );
      expect(getMimeTypeFromFilename('sheet.xls')).toBe('application/vnd.ms-excel');
      expect(getMimeTypeFromFilename('sheet.xlsx')).toBe(
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      expect(getMimeTypeFromFilename('data.csv')).toBe('text/csv');
    });

    it('should return octet-stream for unknown extensions', () => {
      expect(getMimeTypeFromFilename('file.xyz')).toBe('application/octet-stream');
    });

    it('should handle empty/null filenames', () => {
      expect(getMimeTypeFromFilename('')).toBe('application/octet-stream');
      expect(getMimeTypeFromFilename(null)).toBe('application/octet-stream');
    });
  });
});
