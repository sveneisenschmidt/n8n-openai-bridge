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

const McpModelLoader = require('../../../src/loaders/McpModelLoader');

jest.mock('../../../src/mcpClient');

describe('McpModelLoader - Constructor', () => {
  let consoleLogSpy;
  let consoleWarnSpy;

  beforeAll(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
  });

  afterAll(() => {
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should initialize with valid parameters', () => {
    const loader = new McpModelLoader({
      N8N_MCP_ENDPOINT: 'http://n8n:5678/mcp-server/http',
      N8N_MCP_BEARER_TOKEN: 'test-token',
      MCP_POLL_INTERVAL: '300',
    });

    expect(loader.endpoint).toBe('http://n8n:5678/mcp-server/http');
    expect(loader.bearerToken).toBe('test-token');
    expect(loader.pollingInterval).toBe(300);
  });

  test('should have correct TYPE identifier', () => {
    expect(McpModelLoader.TYPE).toBe('mcp');
  });

  test('should validate polling interval (min 60 seconds)', () => {
    const loader = new McpModelLoader({
      N8N_MCP_ENDPOINT: 'http://n8n:5678/mcp-server/http',
      N8N_MCP_BEARER_TOKEN: 'test-token',
      MCP_POLL_INTERVAL: '30',
    });

    expect(loader.pollingInterval).toBe(60);
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Polling interval 30s is too low'),
    );
  });

  test('should validate polling interval (max 600 seconds)', () => {
    const loader = new McpModelLoader({
      N8N_MCP_ENDPOINT: 'http://n8n:5678/mcp-server/http',
      N8N_MCP_BEARER_TOKEN: 'test-token',
      MCP_POLL_INTERVAL: '1000',
    });

    expect(loader.pollingInterval).toBe(600);
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Polling interval 1000s is too high'),
    );
  });

  test('should allow polling interval of 0 (disabled)', () => {
    const loader = new McpModelLoader({
      N8N_MCP_ENDPOINT: 'http://n8n:5678/mcp-server/http',
      N8N_MCP_BEARER_TOKEN: 'test-token',
      MCP_POLL_INTERVAL: '0',
    });

    expect(loader.pollingInterval).toBe(0);
  });

  test('should throw error for negative polling interval', () => {
    expect(() => {
      new McpModelLoader({
        N8N_MCP_ENDPOINT: 'http://n8n:5678/mcp-server/http',
        N8N_MCP_BEARER_TOKEN: 'test-token',
        MCP_POLL_INTERVAL: '-10',
      });
    }).toThrow('Polling interval must be >= 0');
  });

  test('should create MCP client instance', () => {
    const loader = new McpModelLoader({
      N8N_MCP_ENDPOINT: 'http://n8n:5678/mcp-server/http',
      N8N_MCP_BEARER_TOKEN: 'test-token',
      MCP_POLL_INTERVAL: '300',
    });

    expect(loader.mcpClient).toBeDefined();
  });

  test('should define required environment variables', () => {
    const envVars = McpModelLoader.getRequiredEnvVars();

    expect(envVars).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'N8N_MCP_ENDPOINT', required: true }),
        expect.objectContaining({ name: 'N8N_MCP_BEARER_TOKEN', required: true }),
        expect.objectContaining({
          name: 'MCP_POLL_INTERVAL',
          required: false,
          defaultValue: '300',
        }),
      ]),
    );
  });
});
