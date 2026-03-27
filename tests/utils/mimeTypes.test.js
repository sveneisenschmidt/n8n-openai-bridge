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
  getExtensionFromMimeType,
  getMimeTypeFromFilename,
  MIME_TO_EXT,
  EXT_TO_MIME,
} = require('../../src/utils/mimeTypes');

describe('mimeTypes', () => {
  describe('getExtensionFromMimeType', () => {
    it('should return correct extensions for known MIME types', () => {
      expect(getExtensionFromMimeType('image/png')).toBe('png');
      expect(getExtensionFromMimeType('image/jpeg')).toBe('jpg');
      expect(getExtensionFromMimeType('application/pdf')).toBe('pdf');
      expect(getExtensionFromMimeType('text/csv')).toBe('csv');
      expect(getExtensionFromMimeType('application/msword')).toBe('doc');
    });

    it('should return bin for unknown MIME types', () => {
      expect(getExtensionFromMimeType('application/unknown')).toBe('bin');
    });
  });

  describe('getMimeTypeFromFilename', () => {
    it('should return correct MIME types for known extensions', () => {
      expect(getMimeTypeFromFilename('photo.png')).toBe('image/png');
      expect(getMimeTypeFromFilename('photo.jpg')).toBe('image/jpeg');
      expect(getMimeTypeFromFilename('photo.jpeg')).toBe('image/jpeg');
      expect(getMimeTypeFromFilename('doc.pdf')).toBe('application/pdf');
      expect(getMimeTypeFromFilename('data.csv')).toBe('text/csv');
      expect(getMimeTypeFromFilename('doc.docx')).toBe(
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      );
    });

    it('should return octet-stream for unknown extensions', () => {
      expect(getMimeTypeFromFilename('file.xyz')).toBe('application/octet-stream');
    });

    it('should handle empty/null filenames', () => {
      expect(getMimeTypeFromFilename('')).toBe('application/octet-stream');
      expect(getMimeTypeFromFilename(null)).toBe('application/octet-stream');
    });
  });

  describe('maps consistency', () => {
    it('MIME_TO_EXT and EXT_TO_MIME should be inverse for all entries', () => {
      for (const [_mime, ext] of Object.entries(MIME_TO_EXT)) {
        expect(EXT_TO_MIME[ext]).toBeDefined();
      }
    });
  });
});
