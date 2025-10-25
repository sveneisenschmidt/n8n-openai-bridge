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
  let activeLoaders = [];

  beforeAll(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    testSetup = setupLoaderTestDir();
  });

  afterAll(() => {
    consoleLogSpy.mockRestore();
    testSetup.cleanup();
  });

  beforeEach(() => {
    activeLoaders = [];
    const validModels = {
      'test-model-1': 'https://example.com/webhook1',
      'test-model-2': 'https://example.com/webhook2',
    };
    testFile = testSetup.createTestFile('test-models-watch.json', validModels);
  });

  afterEach(() => {
    // Stop all active watchers before cleanup
    activeLoaders.forEach((loader) => {
      if (loader && loader.pollingInterval) {
        loader.stopWatching();
      }
    });
    activeLoaders = [];
    testSetup.cleanup();
  });

  test('should not throw when watching non-existent file', () => {
    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    const loader = new JsonFileModelLoader({
      MODELS_CONFIG_FILE: testSetup.getTestFilePath('nonexistent.json'),
    });
    activeLoaders.push(loader);
    expect(() => loader.watch(() => {})).not.toThrow();
    consoleWarnSpy.mockRestore();
  });

  test('should not watch twice', () => {
    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    const loader = new JsonFileModelLoader({ MODELS_CONFIG_FILE: testFile });
    activeLoaders.push(loader);

    loader.watch(() => {});
    loader.watch(() => {});

    // Either "Already watching" or "Could not watch" message is expected
    const calls = consoleWarnSpy.mock.calls;
    const hasWarning = calls.some((call) => {
      const message = call[0];
      return message.includes('Already watching') || message.includes('Could not watch');
    });
    expect(hasWarning).toBe(true);

    consoleWarnSpy.mockRestore();
  });

  test('should call callback when file changes', async () => {
    // Use 0.2s (200ms) polling interval for faster test execution
    const loader = new JsonFileModelLoader({
      MODELS_CONFIG_FILE: testFile,
      MODELS_POLL_INTERVAL: '0.2',
    });
    activeLoaders.push(loader);

    let callCount = 0;
    const startTime = Date.now();
    const receivedModels = [];

    const callbackPromise = new Promise((resolve) => {
      loader.watch((models) => {
        callCount++;
        const elapsed = Date.now() - startTime;
        console.log(`Callback fired (call ${callCount}) after ${elapsed}ms`);

        receivedModels.push(models);

        // Wait for second call before resolving
        if (callCount >= 2) {
          resolve();
        }
      });

      console.log('Polling started, initial hash:', loader.lastHash);

      // Wait for first poll, then change file
      setTimeout(() => {
        console.log('Writing file...');
        const newModels = {
          'updated-model': 'https://example.com/updated',
        };
        fs.writeFileSync(testFile, JSON.stringify(newModels));
        console.log('File written');
      }, 250); // Wait for first poll to complete

      // Debug: Log if polling interval exists
      setTimeout(() => {
        console.log('Polling interval active?', loader.pollingInterval !== null);
      }, 100);
    });

    await callbackPromise;

    // Verify first call had initial models
    expect(receivedModels[0]).toEqual({
      'test-model-1': 'https://example.com/webhook1',
      'test-model-2': 'https://example.com/webhook2',
    });

    // Verify second call had updated models
    expect(receivedModels[1]).toEqual({
      'updated-model': 'https://example.com/updated',
    });
  }, 5000); // 5s timeout for debugging
});
