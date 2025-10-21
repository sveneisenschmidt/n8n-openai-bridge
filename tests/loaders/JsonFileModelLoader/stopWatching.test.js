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

describe('JsonFileModelLoader - stopWatching', () => {
  const testDir = path.join(__dirname, '..', '..', '..', 'tests', 'test-data');
  const testFile = path.join(testDir, 'test-models-stop.json');
  let consoleLogSpy;
  let loaders = [];

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
    loaders = [];
    const validModels = {
      'test-model-1': 'https://example.com/webhook1',
      'test-model-2': 'https://example.com/webhook2',
    };
    fs.writeFileSync(testFile, JSON.stringify(validModels, null, 2));
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
    const loader = new JsonFileModelLoader({ MODELS_CONFIG: testFile });
    loaders.push(loader);
    loader.watch(() => {});

    expect(loader.watcher).not.toBeNull();
    loader.stopWatching();
    expect(loader.watcher).toBeNull();
  });

  test('should not throw when called without active watcher', () => {
    const loader = new JsonFileModelLoader({ MODELS_CONFIG: testFile });
    loaders.push(loader);
    expect(() => loader.stopWatching()).not.toThrow();
  });

  test('should clear reload timeout', async () => {
    const loader = new JsonFileModelLoader({ MODELS_CONFIG: testFile });
    loaders.push(loader);
    loader.watch(() => {});

    await new Promise((resolve) => setTimeout(resolve, 200));

    // Ensure directory exists before writing
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }

    fs.writeFileSync(testFile, JSON.stringify({ test: 'https://example.com' }));

    // Stop watching immediately after triggering change
    await new Promise((resolve) => setTimeout(resolve, 50));
    loader.stopWatching();
    expect(loader.reloadTimeout).toBeNull();
  }, 10000);
});
