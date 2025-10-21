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

const N8nApiModelLoader = require('../../../src/loaders/N8nApiModelLoader');

describe('N8nApiModelLoader - Environment Variables', () => {
  test('should return required environment variables', () => {
    const envVars = N8nApiModelLoader.getRequiredEnvVars();

    expect(envVars).toHaveLength(4);
    expect(envVars).toContainEqual({
      name: 'N8N_BASE_URL',
      description: 'Base URL of n8n instance',
      required: true,
    });
    expect(envVars).toContainEqual({
      name: 'N8N_API_BEARER_TOKEN',
      description: 'n8n API key for REST API access',
      required: true,
    });
    expect(envVars).toContainEqual({
      name: 'AUTO_DISCOVERY_TAG',
      description: 'Tag to filter workflows',
      required: false,
      defaultValue: 'n8n-openai-bridge',
    });
    expect(envVars).toContainEqual({
      name: 'AUTO_DISCOVERY_POLL_INTERVAL',
      description: 'Polling interval in seconds (60-600, 0=disabled)',
      required: false,
      defaultValue: '300',
    });
  });

  test('should have TYPE property set to "n8n-api"', () => {
    expect(N8nApiModelLoader.TYPE).toBe('n8n-api');
  });
});
