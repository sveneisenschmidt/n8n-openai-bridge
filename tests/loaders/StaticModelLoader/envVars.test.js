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

const StaticModelLoader = require('../../../src/loaders/StaticModelLoader');

describe('StaticModelLoader - Environment Variables', () => {
  test('should return STATIC_MODELS as optional env var', () => {
    const envVars = StaticModelLoader.getRequiredEnvVars();

    expect(envVars).toHaveLength(1);
    expect(envVars[0]).toEqual({
      name: 'STATIC_MODELS',
      description: 'JSON string with static models for testing',
      required: false,
      defaultValue: '{}',
    });
  });

  test('should have TYPE property set to "static"', () => {
    expect(StaticModelLoader.TYPE).toBe('static');
  });
});
