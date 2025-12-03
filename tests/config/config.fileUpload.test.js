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

const Config = require('../../src/config/Config');

// Mock console methods to reduce noise in test output
global.console = {
  ...console,
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

describe('Config - File Upload Configuration', () => {
  let originalEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.clearAllMocks();
  });

  describe('default values', () => {
    beforeEach(() => {
      delete process.env.FILE_UPLOAD_MODE;
    });

    test('should use default FILE_UPLOAD_MODE of passthrough', () => {
      const config = new Config();
      expect(config.fileUploadMode).toBe('passthrough');
    });
  });

  describe('valid modes', () => {
    test('should accept passthrough mode', () => {
      process.env.FILE_UPLOAD_MODE = 'passthrough';
      const config = new Config();
      expect(config.fileUploadMode).toBe('passthrough');
    });

    test('should accept extract-json mode', () => {
      process.env.FILE_UPLOAD_MODE = 'extract-json';
      const config = new Config();
      expect(config.fileUploadMode).toBe('extract-json');
    });

    test('should accept extract-multipart mode', () => {
      process.env.FILE_UPLOAD_MODE = 'extract-multipart';
      const config = new Config();
      expect(config.fileUploadMode).toBe('extract-multipart');
    });

    test('should accept disabled mode', () => {
      process.env.FILE_UPLOAD_MODE = 'disabled';
      const config = new Config();
      expect(config.fileUploadMode).toBe('disabled');
    });

    test('should normalize to lowercase', () => {
      process.env.FILE_UPLOAD_MODE = 'EXTRACT-JSON';
      const config = new Config();
      expect(config.fileUploadMode).toBe('extract-json');
    });

    test('should trim whitespace', () => {
      process.env.FILE_UPLOAD_MODE = '  passthrough  ';
      const config = new Config();
      expect(config.fileUploadMode).toBe('passthrough');
    });
  });

  describe('validation', () => {
    test('should warn and use default for invalid mode', () => {
      process.env.FILE_UPLOAD_MODE = 'invalid-mode';
      const config = new Config();
      expect(config.fileUploadMode).toBe('passthrough');
      expect(console.warn).toHaveBeenCalledWith(
        "FILE_UPLOAD_MODE 'invalid-mode' is invalid. Valid modes: passthrough, extract-json, extract-multipart, disabled. Using default: passthrough.",
      );
    });

    test('should handle empty string as default', () => {
      process.env.FILE_UPLOAD_MODE = '';
      const config = new Config();
      expect(config.fileUploadMode).toBe('passthrough');
    });

    test('should handle whitespace-only string as default', () => {
      process.env.FILE_UPLOAD_MODE = '   ';
      const config = new Config();
      expect(config.fileUploadMode).toBe('passthrough');
    });
  });

  describe('static FILE_UPLOAD_MODES', () => {
    test('should expose valid modes as static property', () => {
      expect(Config.FILE_UPLOAD_MODES).toEqual([
        'passthrough',
        'extract-json',
        'extract-multipart',
        'disabled',
      ]);
    });
  });
});
