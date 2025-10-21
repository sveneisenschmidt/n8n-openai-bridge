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

describe('JsonFileModelLoader - stopWatching', () => {
  let testSetup;
  let testFile;
  let consoleLogSpy;
  let loaders = [];

  beforeAll(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    testSetup = setupLoaderTestDir();
  });

  afterAll(() => {
    consoleLogSpy.mockRestore();
    testSetup.cleanup();
  });

  beforeEach(() => {
    loaders = [];
    const validModels = {
      'test-model-1': 'https://example.com/webhook1',
      'test-model-2': 'https://example.com/webhook2',
    };
    testFile = testSetup.createTestFile('test-models-stop.json', validModels);
  });

  afterEach(() => {
    // Stop all watchers
    loaders.forEach((loader) => {
      if (loader) {
        loader.stopWatching();
      }
    });
    loaders = [];

    if (fs.existsSync(testFile)) {
      fs.unlinkSync(testFile);
    }
  });

  test('should stop watching file', () => {
    const loader = new JsonFileModelLoader({ MODELS_CONFIG_FILE: testFile });
    loaders.push(loader);
    loader.watch(() => {});

    expect(loader.pollingInterval).not.toBeNull();
    loader.stopWatching();
    expect(loader.pollingInterval).toBeNull();
  });

  test('should not throw when called without active watcher', () => {
    const loader = new JsonFileModelLoader({ MODELS_CONFIG_FILE: testFile });
    loaders.push(loader);
    expect(() => loader.stopWatching()).not.toThrow();
  });
});
