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

describe('JsonFileModelLoader - load', () => {
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
    testFile = testSetup.createTestFile('test-models.json', validModels);
  });

  afterEach(() => {
    testSetup.cleanup();
  });

  test('should load valid JSON file', async () => {
    const loader = new JsonFileModelLoader({ MODELS_CONFIG: testFile });
    const models = await loader.load();

    expect(models).toEqual({
      'test-model-1': 'https://example.com/webhook1',
      'test-model-2': 'https://example.com/webhook2',
    });
  });

  test('should throw error for non-existent file', async () => {
    const loader = new JsonFileModelLoader({
      MODELS_CONFIG: testSetup.getTestFilePath('nonexistent.json'),
    });
    await expect(loader.load()).rejects.toThrow('Models file not found');
  });

  test('should throw error for invalid JSON', async () => {
    fs.writeFileSync(testFile, '{ invalid json }');
    const loader = new JsonFileModelLoader({ MODELS_CONFIG: testFile });
    await expect(loader.load()).rejects.toThrow('Invalid JSON in models file');
  });

  test('should filter out models with invalid URLs', async () => {
    fs.writeFileSync(
      testFile,
      JSON.stringify({
        'model-1': 'not-a-valid-url',
        'model-2': 'https://valid.example.com/webhook',
      }),
    );
    const loader = new JsonFileModelLoader({ MODELS_CONFIG: testFile });
    const models = await loader.load();
    expect(models).toEqual({
      'model-2': 'https://valid.example.com/webhook',
    });
  });

  test('should accept empty models object', async () => {
    fs.writeFileSync(testFile, JSON.stringify({}));
    const loader = new JsonFileModelLoader({ MODELS_CONFIG: testFile });
    const models = await loader.load();
    expect(models).toEqual({});
  });
});
