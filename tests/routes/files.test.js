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

const express = require('express');
const request = require('supertest');
const filesRoute = require('../../src/routes/files');

describe('files route', () => {
  let app;
  let mockFileService;
  let consoleErrorSpy;

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

    app = express();
    app.use(express.json());

    mockFileService = {
      upload: jest.fn(),
      getFile: jest.fn(),
      getFileContent: jest.fn(),
      deleteFile: jest.fn(),
      listFiles: jest.fn(),
    };

    app.locals.fileService = mockFileService;
    app.locals.config = {
      filesMaxFileSize: 20 * 1024 * 1024,
    };

    app.use('/', filesRoute);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe('POST /', () => {
    it('should upload a file and return metadata', async () => {
      const metadata = {
        id: 'file-123',
        object: 'file',
        bytes: 11,
        created_at: 1000,
        filename: 'test.txt',
        purpose: 'assistants',
        status: 'processed',
      };
      mockFileService.upload.mockReturnValue(metadata);

      const response = await request(app)
        .post('/')
        .field('purpose', 'assistants')
        .attach('file', Buffer.from('hello world'), 'test.txt');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(metadata);
      expect(mockFileService.upload).toHaveBeenCalledWith(
        'test.txt',
        'assistants',
        expect.any(Buffer),
      );
    });

    it('should return 400 if file is missing', async () => {
      const response = await request(app).post('/').field('purpose', 'assistants');

      expect(response.status).toBe(400);
      expect(response.body.error.message).toMatch(/missing.*file/i);
    });

    it('should return 400 if purpose is missing', async () => {
      const response = await request(app).post('/').attach('file', Buffer.from('data'), 'test.txt');

      expect(response.status).toBe(400);
      expect(response.body.error.message).toMatch(/missing.*purpose/i);
    });

    it('should return 400 for invalid purpose', async () => {
      const response = await request(app)
        .post('/')
        .field('purpose', 'invalid')
        .attach('file', Buffer.from('data'), 'test.txt');

      expect(response.status).toBe(400);
      expect(response.body.error.message).toMatch(/invalid purpose/i);
      expect(response.body.error.message).not.toContain("'invalid'");
    });

    it('should return 413 when file too large', async () => {
      const error = new Error('File size exceeds maximum');
      error.code = 'FILE_TOO_LARGE';
      mockFileService.upload.mockImplementation(() => {
        throw error;
      });

      const response = await request(app)
        .post('/')
        .field('purpose', 'assistants')
        .attach('file', Buffer.from('data'), 'test.txt');

      expect(response.status).toBe(413);
    });

    it('should return 413 when storage limit exceeded', async () => {
      const error = new Error('Total file storage limit exceeded');
      error.code = 'STORAGE_LIMIT_EXCEEDED';
      mockFileService.upload.mockImplementation(() => {
        throw error;
      });

      const response = await request(app)
        .post('/')
        .field('purpose', 'assistants')
        .attach('file', Buffer.from('data'), 'test.txt');

      expect(response.status).toBe(413);
    });
  });

  describe('GET /', () => {
    it('should list files', async () => {
      const listResult = {
        object: 'list',
        data: [{ id: 'file-1', object: 'file' }],
        has_more: false,
      };
      mockFileService.listFiles.mockReturnValue(listResult);

      const response = await request(app).get('/');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(listResult);
    });

    it('should pass query parameters to listFiles', async () => {
      mockFileService.listFiles.mockReturnValue({ object: 'list', data: [], has_more: false });

      await request(app).get('/?purpose=vision&limit=10&order=asc&after=file-1');

      expect(mockFileService.listFiles).toHaveBeenCalledWith({
        purpose: 'vision',
        limit: '10',
        order: 'asc',
        after: 'file-1',
      });
    });
  });

  describe('GET /:file_id', () => {
    it('should return file metadata', async () => {
      const metadata = { id: 'file-123', object: 'file', bytes: 100 };
      mockFileService.getFile.mockReturnValue(metadata);

      const response = await request(app).get('/file-123');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(metadata);
    });

    it('should return 404 for missing file', async () => {
      mockFileService.getFile.mockReturnValue(null);

      const response = await request(app).get('/file-nonexistent');

      expect(response.status).toBe(404);
      expect(response.body.error.type).toBe('invalid_request_error');
    });
  });

  describe('DELETE /:file_id', () => {
    it('should delete file and return confirmation', async () => {
      const result = { id: 'file-123', object: 'file', deleted: true };
      mockFileService.deleteFile.mockReturnValue(result);

      const response = await request(app).delete('/file-123');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(result);
    });

    it('should return 404 for missing file', async () => {
      mockFileService.deleteFile.mockReturnValue(null);

      const response = await request(app).delete('/file-nonexistent');

      expect(response.status).toBe(404);
    });
  });

  describe('GET /:file_id/content', () => {
    it('should return binary content with correct content-type', async () => {
      const buffer = Buffer.from('PDF content');
      mockFileService.getFileContent.mockReturnValue({
        buffer,
        metadata: { filename: 'doc.pdf' },
      });

      const response = await request(app).get('/file-123/content');

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toMatch(/application\/pdf/);
      expect(response.headers['content-disposition']).toMatch(/doc\.pdf/);
      expect(Buffer.from(response.body).toString()).toBe('PDF content');
    });

    it('should return 404 for missing file', async () => {
      mockFileService.getFileContent.mockReturnValue(null);

      const response = await request(app).get('/file-nonexistent/content');

      expect(response.status).toBe(404);
    });
  });
});
