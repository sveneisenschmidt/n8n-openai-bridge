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
    const loader = new JsonFileModelLoader({ MODELS_CONFIG: './models.json' });
    expect(path.isAbsolute(loader.filePath)).toBe(true);
  });

  test('should accept absolute paths', () => {
    const absolutePath = '/absolute/path/models.json';
    const loader = new JsonFileModelLoader({ MODELS_CONFIG: absolutePath });
    expect(loader.filePath).toBe(absolutePath);
  });
});
