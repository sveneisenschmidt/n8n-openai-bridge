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

const path = require('path');
const JsonFileModelLoader = require('../../../src/loaders/JsonFileModelLoader');

describe('JsonFileModelLoader - Constructor', () => {
  let consoleLogSpy;

  beforeAll(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
  });

  afterAll(() => {
    consoleLogSpy.mockRestore();
  });

  test('should resolve relative paths to absolute', () => {
    const loader = new JsonFileModelLoader({ MODELS_CONFIG_FILE: './models.json' });
    expect(path.isAbsolute(loader.filePath)).toBe(true);
  });

  test('should accept absolute paths', () => {
    const absolutePath = '/absolute/path/models.json';
    const loader = new JsonFileModelLoader({ MODELS_CONFIG_FILE: absolutePath });
    expect(loader.filePath).toBe(absolutePath);
  });

  test('should support deprecated MODELS_CONFIG with warning', () => {
    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    const loader = new JsonFileModelLoader({ MODELS_CONFIG: './models.json' });
    expect(path.isAbsolute(loader.filePath)).toBe(true);
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      'MODELS_CONFIG is deprecated, please use MODELS_CONFIG_FILE instead',
    );
    consoleWarnSpy.mockRestore();
  });

  test('should prefer MODELS_CONFIG_FILE over MODELS_CONFIG', () => {
    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    const loader = new JsonFileModelLoader({
      MODELS_CONFIG_FILE: './new-models.json',
      MODELS_CONFIG: './old-models.json',
    });
    expect(loader.filePath).toContain('new-models.json');
    expect(consoleWarnSpy).not.toHaveBeenCalled();
    consoleWarnSpy.mockRestore();
  });

  test('should use default watchInterval of 1000ms', () => {
    const loader = new JsonFileModelLoader({ MODELS_CONFIG_FILE: './models.json' });
    expect(loader.watchInterval).toBe(1000);
  });

  test('should accept watchInterval via MODELS_POLL_INTERVAL env var', () => {
    const loader = new JsonFileModelLoader({
      MODELS_CONFIG_FILE: './models.json',
      MODELS_POLL_INTERVAL: '2',
    });
    expect(loader.watchInterval).toBe(2000);
  });
});
