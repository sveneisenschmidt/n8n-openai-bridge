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

const FileRepository = require('../../src/repositories/FileRepository');
const FileService = require('../../src/services/fileService');

describe('FileService', () => {
  let repo;
  let service;
  let config;
  let consoleLogSpy;

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    repo = new FileRepository();
    config = {
      filesMaxFileSize: 1024 * 1024, // 1MB
      filesMaxTotalStorage: 10 * 1024 * 1024, // 10MB
      filesMaxCount: 1000,
      filesTtlSeconds: 3600,
      filesCleanupIntervalSeconds: 60,
    };
    service = new FileService(repo, config);
  });

  afterEach(() => {
    service.stopCleanupInterval();
    consoleLogSpy.mockRestore();
  });

  describe('upload', () => {
    it('should store a file and return metadata', () => {
      const buffer = Buffer.from('hello world');
      const result = service.upload('test.txt', 'assistants', buffer);

      expect(result.id).toMatch(/^file-/);
      expect(result.object).toBe('file');
      expect(result.bytes).toBe(buffer.length);
      expect(result.filename).toBe('test.txt');
      expect(result.purpose).toBe('assistants');
      expect(result.status).toBe('processed');
      expect(result.expires_at).toBeGreaterThan(result.created_at);
    });

    it('should reject files exceeding max file size', () => {
      const buffer = Buffer.alloc(config.filesMaxFileSize + 1);

      expect(() => service.upload('large.bin', 'assistants', buffer)).toThrow(/exceeds maximum/);
    });

    it('should set FILE_TOO_LARGE error code', () => {
      const buffer = Buffer.alloc(config.filesMaxFileSize + 1);

      expect(() => service.upload('large.bin', 'assistants', buffer)).toThrow(
        expect.objectContaining({ code: 'FILE_TOO_LARGE' }),
      );
    });

    it('should reject when total storage would be exceeded', () => {
      // Use a small total storage limit for this test
      config.filesMaxTotalStorage = 500;
      config.filesMaxFileSize = 1000;
      const buffer = Buffer.alloc(400);
      service.upload('big.bin', 'assistants', buffer);

      // This should exceed the 500 byte total limit
      const smallBuffer = Buffer.alloc(200);
      expect(() => service.upload('small.bin', 'assistants', smallBuffer)).toThrow(
        /storage limit exceeded/i,
      );
    });

    it('should set STORAGE_LIMIT_EXCEEDED error code', () => {
      config.filesMaxTotalStorage = 500;
      config.filesMaxFileSize = 1000;
      const buffer = Buffer.alloc(400);
      service.upload('big.bin', 'assistants', buffer);

      expect(() => service.upload('small.bin', 'assistants', Buffer.alloc(200))).toThrow(
        expect.objectContaining({ code: 'STORAGE_LIMIT_EXCEEDED' }),
      );
    });

    it('should reject when file count limit is reached', () => {
      config.filesMaxCount = 2;
      service.upload('a.txt', 'assistants', Buffer.from('a'));
      service.upload('b.txt', 'assistants', Buffer.from('b'));

      expect(() => service.upload('c.txt', 'assistants', Buffer.from('c'))).toThrow(
        /file count limit/i,
      );
    });

    it('should set FILE_COUNT_LIMIT_EXCEEDED error code', () => {
      config.filesMaxCount = 1;
      service.upload('a.txt', 'assistants', Buffer.from('a'));

      expect(() => service.upload('b.txt', 'assistants', Buffer.from('b'))).toThrow(
        expect.objectContaining({ code: 'FILE_COUNT_LIMIT_EXCEEDED' }),
      );
    });

    it('should allow upload after deleting when at count limit', () => {
      config.filesMaxCount = 1;
      const first = service.upload('a.txt', 'assistants', Buffer.from('a'));
      service.deleteFile(first.id);

      const second = service.upload('b.txt', 'assistants', Buffer.from('b'));
      expect(second.id).toMatch(/^file-/);
    });

    it('should sanitize filenames with path traversal', () => {
      const result = service.upload('../../etc/passwd', 'assistants', Buffer.from('x'));
      expect(result.filename).toBe('passwd');
    });

    it('should sanitize filenames with control characters', () => {
      const result = service.upload('file\x00name\x1f.txt', 'assistants', Buffer.from('x'));
      expect(result.filename).toBe('filename.txt');
    });

    it('should sanitize filenames with double-quote characters', () => {
      const result = service.upload('file"name.txt', 'assistants', Buffer.from('x'));
      expect(result.filename).toBe('file_name.txt');
    });

    it('should strip Windows backslash paths to base filename', () => {
      const result = service.upload('C:\\Users\\docs\\report.pdf', 'assistants', Buffer.from('x'));
      expect(result.filename).toBe('report.pdf');
    });

    it('should use fallback for empty filenames', () => {
      const result = service.upload('', 'assistants', Buffer.from('x'));
      expect(result.filename).toBe('unnamed');
    });
  });

  describe('getFile', () => {
    it('should return metadata for existing file', () => {
      const buffer = Buffer.from('test');
      const uploaded = service.upload('test.txt', 'assistants', buffer);

      const result = service.getFile(uploaded.id);
      expect(result).toEqual(uploaded);
    });

    it('should return null for missing file', () => {
      expect(service.getFile('file-nonexistent')).toBeNull();
    });

    it('should return null and evict expired file', () => {
      const uploaded = service.upload('test.txt', 'assistants', Buffer.from('test'));
      const entry = repo.get(uploaded.id);
      entry.metadata.expires_at = Math.floor(Date.now() / 1000) - 1;

      expect(service.getFile(uploaded.id)).toBeNull();
      expect(repo.get(uploaded.id)).toBeUndefined();
    });
  });

  describe('getFileContent', () => {
    it('should return buffer and metadata for existing file', () => {
      const buffer = Buffer.from('test content');
      const uploaded = service.upload('test.txt', 'assistants', buffer);

      const result = service.getFileContent(uploaded.id);
      expect(result.buffer).toEqual(buffer);
      expect(result.metadata).toEqual(uploaded);
    });

    it('should return null for missing file', () => {
      expect(service.getFileContent('file-nonexistent')).toBeNull();
    });

    it('should return null and evict expired file', () => {
      const uploaded = service.upload('test.txt', 'assistants', Buffer.from('test'));
      const entry = repo.get(uploaded.id);
      entry.metadata.expires_at = Math.floor(Date.now() / 1000) - 1;

      expect(service.getFileContent(uploaded.id)).toBeNull();
      expect(repo.get(uploaded.id)).toBeUndefined();
    });
  });

  describe('deleteFile', () => {
    it('should delete and return confirmation', () => {
      const uploaded = service.upload('test.txt', 'assistants', Buffer.from('test'));

      const result = service.deleteFile(uploaded.id);
      expect(result).toEqual({
        id: uploaded.id,
        object: 'file',
        deleted: true,
      });
    });

    it('should return null for missing file', () => {
      expect(service.deleteFile('file-nonexistent')).toBeNull();
    });

    it('should make file inaccessible after deletion', () => {
      const uploaded = service.upload('test.txt', 'assistants', Buffer.from('test'));
      service.deleteFile(uploaded.id);

      expect(service.getFile(uploaded.id)).toBeNull();
    });
  });

  describe('listFiles', () => {
    it('should return list structure with data and has_more', () => {
      service.upload('a.txt', 'assistants', Buffer.from('a'));
      service.upload('b.txt', 'vision', Buffer.from('b'));

      const result = service.listFiles();
      expect(result.object).toBe('list');
      expect(result.data).toHaveLength(2);
      expect(result.has_more).toBe(false);
    });

    it('should filter by purpose', () => {
      service.upload('a.txt', 'assistants', Buffer.from('a'));
      service.upload('b.txt', 'vision', Buffer.from('b'));

      const result = service.listFiles({ purpose: 'vision' });
      expect(result.data).toHaveLength(1);
      expect(result.data[0].purpose).toBe('vision');
    });

    it('should indicate has_more when results exceed limit', () => {
      service.upload('a.txt', 'assistants', Buffer.from('a'));
      service.upload('b.txt', 'assistants', Buffer.from('b'));
      service.upload('c.txt', 'assistants', Buffer.from('c'));

      const result = service.listFiles({ limit: 2 });
      expect(result.data).toHaveLength(2);
      expect(result.has_more).toBe(true);
    });

    it('should clamp limit to valid range', () => {
      service.upload('a.txt', 'assistants', Buffer.from('a'));

      const result = service.listFiles({ limit: -5 });
      expect(result.data).toHaveLength(1);
    });
  });

  describe('cleanup', () => {
    it('should remove expired files', () => {
      const uploaded = service.upload('test.txt', 'assistants', Buffer.from('test'));

      // Manually set expiration to past
      const entry = repo.get(uploaded.id);
      entry.metadata.expires_at = Math.floor(Date.now() / 1000) - 1;

      const cleaned = service.cleanup();
      expect(cleaned).toBe(1);
      expect(repo.get(uploaded.id)).toBeUndefined();
    });

    it('should keep non-expired files', () => {
      const uploaded = service.upload('test.txt', 'assistants', Buffer.from('test'));

      const cleaned = service.cleanup();
      expect(cleaned).toBe(0);
      expect(service.getFile(uploaded.id)).not.toBeNull();
    });

    it('should log when files are cleaned', () => {
      const uploaded = service.upload('test.txt', 'assistants', Buffer.from('test'));
      const entry = repo.get(uploaded.id);
      entry.metadata.expires_at = Math.floor(Date.now() / 1000) - 1;

      service.cleanup();
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('File cleanup: removed 1 expired file(s)'),
      );
    });
  });

  describe('cleanup interval', () => {
    it('should start and stop cleanup interval', () => {
      jest.useFakeTimers();

      service.startCleanupInterval();
      expect(service.cleanupTimer).not.toBeNull();

      service.stopCleanupInterval();
      expect(service.cleanupTimer).toBeNull();

      jest.useRealTimers();
    });

    it('should not start multiple intervals', () => {
      jest.useFakeTimers();

      service.startCleanupInterval();
      const firstTimer = service.cleanupTimer;
      service.startCleanupInterval();
      expect(service.cleanupTimer).toBe(firstTimer);

      service.stopCleanupInterval();
      jest.useRealTimers();
    });

    it('should handle stopCleanupInterval when no timer exists', () => {
      expect(() => service.stopCleanupInterval()).not.toThrow();
    });
  });

  describe('static methods', () => {
    it('generateFileId should return file- prefixed ID', () => {
      const id = FileService.generateFileId();
      expect(id).toMatch(/^file-[0-9a-f-]+$/);
    });

    it('isValidPurpose should validate known purposes', () => {
      expect(FileService.isValidPurpose('assistants')).toBe(true);
      expect(FileService.isValidPurpose('vision')).toBe(true);
      expect(FileService.isValidPurpose('batch')).toBe(true);
      expect(FileService.isValidPurpose('fine-tune')).toBe(true);
      expect(FileService.isValidPurpose('user_data')).toBe(true);
      expect(FileService.isValidPurpose('evals')).toBe(true);
    });

    it('isValidPurpose should reject invalid purposes', () => {
      expect(FileService.isValidPurpose('invalid')).toBe(false);
      expect(FileService.isValidPurpose('')).toBe(false);
    });

    it('isExpired should detect expired entries', () => {
      const past = { metadata: { expires_at: Math.floor(Date.now() / 1000) - 1 } };
      const future = { metadata: { expires_at: Math.floor(Date.now() / 1000) + 3600 } };
      expect(FileService.isExpired(past)).toBe(true);
      expect(FileService.isExpired(future)).toBe(false);
    });
  });

  describe('sanitizeFilename', () => {
    it('should return clean filenames unchanged', () => {
      expect(FileService.sanitizeFilename('report.pdf')).toBe('report.pdf');
      expect(FileService.sanitizeFilename('my-file_2024.txt')).toBe('my-file_2024.txt');
    });

    it('should strip Unix path components', () => {
      expect(FileService.sanitizeFilename('/etc/passwd')).toBe('passwd');
      expect(FileService.sanitizeFilename('../../secret.txt')).toBe('secret.txt');
    });

    it('should strip Windows path components', () => {
      expect(FileService.sanitizeFilename('C:\\Users\\evil\\file.exe')).toBe('file.exe');
      expect(FileService.sanitizeFilename('..\\..\\secret.txt')).toBe('secret.txt');
    });

    it('should remove control characters', () => {
      expect(FileService.sanitizeFilename('file\x00.txt')).toBe('file.txt');
      expect(FileService.sanitizeFilename('fi\x0ale\x1f.txt')).toBe('file.txt');
      expect(FileService.sanitizeFilename('file\x7f.txt')).toBe('file.txt');
    });

    it('should replace double-quotes with underscores', () => {
      expect(FileService.sanitizeFilename('file"name.txt')).toBe('file_name.txt');
    });

    it('should treat backslash as path separator and strip to base name', () => {
      expect(FileService.sanitizeFilename('file\\name.txt')).toBe('name.txt');
      expect(FileService.sanitizeFilename('dir\\sub\\file.txt')).toBe('file.txt');
    });

    it('should truncate filenames exceeding max length, preserving extension', () => {
      const longName = `${'a'.repeat(300)}.pdf`;
      const result = FileService.sanitizeFilename(longName);
      expect(result.length).toBe(255);
      expect(result.endsWith('.pdf')).toBe(true);
    });

    it('should truncate filenames without extension', () => {
      const longName = 'a'.repeat(300);
      const result = FileService.sanitizeFilename(longName);
      expect(result.length).toBe(255);
    });

    it('should return unnamed for null/undefined/empty', () => {
      expect(FileService.sanitizeFilename(null)).toBe('unnamed');
      expect(FileService.sanitizeFilename(undefined)).toBe('unnamed');
      expect(FileService.sanitizeFilename('')).toBe('unnamed');
    });

    it('should return unnamed for non-string inputs', () => {
      expect(FileService.sanitizeFilename(123)).toBe('unnamed');
      expect(FileService.sanitizeFilename({})).toBe('unnamed');
    });

    it('should return unnamed when only dots remain', () => {
      expect(FileService.sanitizeFilename('.')).toBe('unnamed');
    });

    it('should handle whitespace-only filenames', () => {
      expect(FileService.sanitizeFilename('   ')).toBe('unnamed');
    });

    it('should trim leading/trailing whitespace', () => {
      expect(FileService.sanitizeFilename('  file.txt  ')).toBe('file.txt');
    });
  });
});
