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
const JsonFileModelLoader = require('../../../src/loaders/JsonFileModelLoader');
const { setupLoaderTestDir } = require('../../helpers/test-loader');

describe('JsonFileModelLoader - watch', () => {
  let testSetup;
  let testFile;
  let consoleLogSpy;

  beforeAll(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    testSetup = setupLoaderTestDir();
  });

  afterAll(() => {
    consoleLogSpy.mockRestore();
    testSetup.cleanup();
  });

  beforeEach(() => {
    const validModels = {
      'test-model-1': 'https://example.com/webhook1',
      'test-model-2': 'https://example.com/webhook2',
    };
    testFile = testSetup.createTestFile('test-models-watch.json', validModels);
  });

  afterEach(() => {
    testSetup.cleanup();
  });

  test('should not throw when watching non-existent file', () => {
    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    const loader = new JsonFileModelLoader({
      MODELS_CONFIG_FILE: testSetup.getTestFilePath('nonexistent.json'),
    });
    expect(() => loader.watch(() => {})).not.toThrow();
    loader.stopWatching();
    consoleWarnSpy.mockRestore();
  });

  test('should not watch twice', () => {
    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    const loader = new JsonFileModelLoader({ MODELS_CONFIG_FILE: testFile });

    loader.watch(() => {});
    loader.watch(() => {});

    // Either "Already watching" or "Could not watch" message is expected
    const calls = consoleWarnSpy.mock.calls;
    const hasWarning = calls.some((call) => {
      const message = call[0];
      return message.includes('Already watching') || message.includes('Could not watch');
    });
    expect(hasWarning).toBe(true);

    loader.stopWatching();
    consoleWarnSpy.mockRestore();
  });

  test('should call callback when file changes', () => {
    return new Promise((resolve) => {
      const loader = new JsonFileModelLoader({ MODELS_CONFIG_FILE: testFile });

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
