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

const JsonHttpModelLoader = require('../../../src/loaders/JsonHttpModelLoader');

describe('JsonHttpModelLoader - Environment Variables', () => {
  describe('getRequiredEnvVars', () => {
    test('should return env var definitions', () => {
      const envVars = JsonHttpModelLoader.getRequiredEnvVars();

      expect(Array.isArray(envVars)).toBe(true);
      expect(envVars.length).toBeGreaterThan(0);
    });

    test('should have JSON_HTTP_ENDPOINT as required', () => {
      const envVars = JsonHttpModelLoader.getRequiredEnvVars();
      const endpointVar = envVars.find((v) => v.name === 'JSON_HTTP_ENDPOINT');

      expect(endpointVar).toBeDefined();
      expect(endpointVar.required).toBe(true);
      expect(endpointVar.description).toBeDefined();
    });

    test('should have JSON_HTTP_POLL_INTERVAL as optional with default', () => {
      const envVars = JsonHttpModelLoader.getRequiredEnvVars();
      const pollVar = envVars.find((v) => v.name === 'JSON_HTTP_POLL_INTERVAL');

      expect(pollVar).toBeDefined();
      expect(pollVar.required).toBe(false);
      expect(pollVar.defaultValue).toBe('300');
    });

    test('should have JSON_HTTP_TIMEOUT as optional with default', () => {
      const envVars = JsonHttpModelLoader.getRequiredEnvVars();
      const timeoutVar = envVars.find((v) => v.name === 'JSON_HTTP_TIMEOUT');

      expect(timeoutVar).toBeDefined();
      expect(timeoutVar.required).toBe(false);
      expect(timeoutVar.defaultValue).toBe('10000');
    });

    test('should have descriptions for all variables', () => {
      const envVars = JsonHttpModelLoader.getRequiredEnvVars();

      envVars.forEach((envVar) => {
        expect(envVar.description).toBeDefined();
        expect(envVar.description.length).toBeGreaterThan(0);
      });
    });
  });

  describe('constructor with environment variables', () => {
    test('should use provided values', () => {
      const loader = new JsonHttpModelLoader({
        JSON_HTTP_ENDPOINT: 'https://api.example.com/config',
        JSON_HTTP_POLL_INTERVAL: '120',
        JSON_HTTP_TIMEOUT: '5000',
      });

      expect(loader.endpoint).toBe('https://api.example.com/config');
      expect(loader.pollingInterval).toBe(120);
      expect(loader.timeout).toBe(5000);
    });
  });
});
