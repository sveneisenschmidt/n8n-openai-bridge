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

describe('Config - Files API', () => {
  let originalEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    jest.resetModules();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  function loadConfig() {
    return new (require('../../src/config/Config'))();
  }

  describe('filesEnabled', () => {
    it('should default to true', () => {
      delete process.env.FILES_ENABLED;
      const config = loadConfig();
      expect(config.filesEnabled).toBe(true);
    });

    it('should be false when set to false', () => {
      process.env.FILES_ENABLED = 'false';
      const config = loadConfig();
      expect(config.filesEnabled).toBe(false);
    });

    it('should be true for any value other than false', () => {
      process.env.FILES_ENABLED = 'true';
      const config = loadConfig();
      expect(config.filesEnabled).toBe(true);
    });
  });

  describe('filesMaxFileSize', () => {
    it('should default to 20MB', () => {
      delete process.env.FILES_MAX_FILE_SIZE;
      const config = loadConfig();
      expect(config.filesMaxFileSize).toBe(20 * 1024 * 1024);
    });

    it('should parse from env var', () => {
      process.env.FILES_MAX_FILE_SIZE = '5242880';
      const config = loadConfig();
      expect(config.filesMaxFileSize).toBe(5242880);
    });

    it('should use default for invalid value', () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
      process.env.FILES_MAX_FILE_SIZE = 'abc';
      const config = loadConfig();
      expect(config.filesMaxFileSize).toBe(20 * 1024 * 1024);
      warnSpy.mockRestore();
    });

    it('should use default for zero', () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
      process.env.FILES_MAX_FILE_SIZE = '0';
      const config = loadConfig();
      expect(config.filesMaxFileSize).toBe(20 * 1024 * 1024);
      warnSpy.mockRestore();
    });
  });

  describe('filesMaxTotalStorage', () => {
    it('should default to 200MB', () => {
      delete process.env.FILES_MAX_TOTAL_STORAGE;
      const config = loadConfig();
      expect(config.filesMaxTotalStorage).toBe(200 * 1024 * 1024);
    });

    it('should parse from env var', () => {
      process.env.FILES_MAX_TOTAL_STORAGE = '104857600';
      const config = loadConfig();
      expect(config.filesMaxTotalStorage).toBe(104857600);
    });
  });

  describe('filesTtlSeconds', () => {
    it('should default to 3600', () => {
      delete process.env.FILES_TTL_SECONDS;
      const config = loadConfig();
      expect(config.filesTtlSeconds).toBe(3600);
    });

    it('should parse from env var', () => {
      process.env.FILES_TTL_SECONDS = '7200';
      const config = loadConfig();
      expect(config.filesTtlSeconds).toBe(7200);
    });
  });

  describe('filesCleanupIntervalSeconds', () => {
    it('should default to 60', () => {
      delete process.env.FILES_CLEANUP_INTERVAL_SECONDS;
      const config = loadConfig();
      expect(config.filesCleanupIntervalSeconds).toBe(60);
    });

    it('should parse from env var', () => {
      process.env.FILES_CLEANUP_INTERVAL_SECONDS = '120';
      const config = loadConfig();
      expect(config.filesCleanupIntervalSeconds).toBe(120);
    });
  });
});
