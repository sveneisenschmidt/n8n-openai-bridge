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

const fs = require('fs');
const path = require('path');
const JsonFileModelLoader = require('../../src/loaders/JsonFileModelLoader');

describe('JsonFileModelLoader', () => {
  const testDir = path.join(__dirname, '..', 'test-data');
  const testFile = path.join(testDir, 'test-models.json');

  beforeAll(() => {
    // Create test directory if it doesn't exist
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
  });

  afterAll(() => {
    // Cleanup test directory
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  beforeEach(() => {
    // Create a valid test models file
    const validModels = {
      'test-model-1': 'https://example.com/webhook1',
      'test-model-2': 'https://example.com/webhook2',
    };
    fs.writeFileSync(testFile, JSON.stringify(validModels, null, 2));
  });

  afterEach(() => {
    // Cleanup test file
    if (fs.existsSync(testFile)) {
      fs.unlinkSync(testFile);
    }
  });

  describe('constructor', () => {
    it('should resolve relative paths to absolute', () => {
      const loader = new JsonFileModelLoader('./models.json');
      expect(path.isAbsolute(loader.filePath)).toBe(true);
    });

    it('should accept absolute paths', () => {
      const absolutePath = '/absolute/path/models.json';
      const loader = new JsonFileModelLoader(absolutePath);
      expect(loader.filePath).toBe(absolutePath);
    });
  });

  describe('load()', () => {
    it('should load valid JSON file', async () => {
      const loader = new JsonFileModelLoader(testFile);
      const models = await loader.load();

      expect(models).toEqual({
        'test-model-1': 'https://example.com/webhook1',
        'test-model-2': 'https://example.com/webhook2',
      });
    });

    it('should throw error for non-existent file', async () => {
      const loader = new JsonFileModelLoader(path.join(testDir, 'nonexistent.json'));
      await expect(loader.load()).rejects.toThrow('Models file not found');
    });

    it('should throw error for invalid JSON', async () => {
      fs.writeFileSync(testFile, '{ invalid json }');
      const loader = new JsonFileModelLoader(testFile);
      await expect(loader.load()).rejects.toThrow('Invalid JSON in models file');
    });

    it('should throw error for invalid models structure', async () => {
      fs.writeFileSync(
        testFile,
        JSON.stringify({
          'model-1': 'not-a-valid-url',
        }),
      );
      const loader = new JsonFileModelLoader(testFile);
      await expect(loader.load()).rejects.toThrow('Invalid webhook URL');
    });

    it('should accept empty models object', async () => {
      fs.writeFileSync(testFile, JSON.stringify({}));
      const loader = new JsonFileModelLoader(testFile);
      const models = await loader.load();
      expect(models).toEqual({});
    });
  });

  describe('watch()', () => {
    it('should call callback when file changes', async () => {
      const loader = new JsonFileModelLoader(testFile);

      const callbackPromise = new Promise((resolve) => {
        const callback = jest.fn((models) => {
          expect(models).toEqual({
            'updated-model': 'https://example.com/updated',
          });
          expect(callback).toHaveBeenCalledTimes(1);
          loader.stopWatching();
          resolve();
        });
        loader.watch(callback);
      });

      // Give watch some time to initialize
      await new Promise((resolve) => setTimeout(resolve, 200));
      const newModels = {
        'updated-model': 'https://example.com/updated',
      };
      fs.writeFileSync(testFile, JSON.stringify(newModels));

      await callbackPromise;
    }, 10000);

    it('should not throw when watching non-existent file', () => {
      const loader = new JsonFileModelLoader(path.join(testDir, 'nonexistent.json'));
      expect(() => loader.watch(() => {})).not.toThrow();
    });

    it('should not watch twice', () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      const loader = new JsonFileModelLoader(testFile);

      loader.watch(() => {});
      loader.watch(() => {});

      expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('Already watching'));

      loader.stopWatching();
      consoleWarnSpy.mockRestore();
    });

    it('should debounce multiple rapid changes', async () => {
      const loader = new JsonFileModelLoader(testFile);
      const callback = jest.fn();

      loader.watch(callback);

      // Give watch some time to initialize
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Trigger multiple rapid changes
      for (let i = 0; i < 5; i++) {
        const models = { [`model-${i}`]: `https://example.com/webhook${i}` };
        fs.writeFileSync(testFile, JSON.stringify(models));
      }

      // Check after debounce period
      await new Promise((resolve) => setTimeout(resolve, 300));

      // Should only be called once due to debouncing
      expect(callback).toHaveBeenCalledTimes(1);
      loader.stopWatching();
    }, 10000);
  });

  describe('stopWatching()', () => {
    it('should stop watching file', () => {
      const loader = new JsonFileModelLoader(testFile);
      loader.watch(() => {});

      expect(loader.watcher).not.toBeNull();
      loader.stopWatching();
      expect(loader.watcher).toBeNull();
    });

    it('should not throw when called without active watcher', () => {
      const loader = new JsonFileModelLoader(testFile);
      expect(() => loader.stopWatching()).not.toThrow();
    });

    it('should clear reload timeout', async () => {
      const loader = new JsonFileModelLoader(testFile);
      loader.watch(() => {});

      await new Promise((resolve) => setTimeout(resolve, 200));
      fs.writeFileSync(testFile, JSON.stringify({ test: 'https://example.com' }));

      // Stop watching immediately after triggering change
      await new Promise((resolve) => setTimeout(resolve, 50));
      loader.stopWatching();
      expect(loader.reloadTimeout).toBeNull();
    }, 10000);
  });
});
