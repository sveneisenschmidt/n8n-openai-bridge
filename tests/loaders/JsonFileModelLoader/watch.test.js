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
const JsonFileModelLoader = require('../../../src/loaders/JsonFileModelLoader');

describe('JsonFileModelLoader - watch', () => {
  const testDir = path.join(__dirname, '..', '..', '..', 'tests', 'test-data');
  const testFile = path.join(testDir, 'test-models-watch.json');
  let consoleLogSpy;

  beforeAll(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
  });

  afterAll(() => {
    consoleLogSpy.mockRestore();
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  beforeEach(() => {
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
    const validModels = {
      'test-model-1': 'https://example.com/webhook1',
      'test-model-2': 'https://example.com/webhook2',
    };
    fs.writeFileSync(testFile, JSON.stringify(validModels, null, 2));
  });

  afterEach(() => {
    if (fs.existsSync(testFile)) {
      fs.unlinkSync(testFile);
    }
  });

  test('should not throw when watching non-existent file', () => {
    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    const loader = new JsonFileModelLoader({
      MODELS_CONFIG: path.join(testDir, 'nonexistent.json'),
    });
    expect(() => loader.watch(() => {})).not.toThrow();
    loader.stopWatching();
    consoleWarnSpy.mockRestore();
  });

  test('should not watch twice', () => {
    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    const loader = new JsonFileModelLoader({ MODELS_CONFIG: testFile });

    loader.watch(() => {});
    loader.watch(() => {});

    expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('Already watching'));

    loader.stopWatching();
    consoleWarnSpy.mockRestore();
  });

  test('should call callback when file changes', () => {
    return new Promise((resolve) => {
      const loader = new JsonFileModelLoader({ MODELS_CONFIG: testFile });

      const callback = jest.fn((models) => {
        expect(models).toEqual({
          'updated-model': 'https://example.com/updated',
        });
        loader.stopWatching();
        resolve();
      });

      loader.watch(callback);

      // Give watcher time to initialize
      setTimeout(() => {
        const newModels = {
          'updated-model': 'https://example.com/updated',
        };
        fs.writeFileSync(testFile, JSON.stringify(newModels));
      }, 100);
    });
  });
});
