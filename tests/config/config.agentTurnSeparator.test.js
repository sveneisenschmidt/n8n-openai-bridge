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

const Config = require('../../src/config/Config');

// Mock console methods to reduce noise in test output
global.console = {
  ...console,
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

describe('Config - Agent Turn Separator', () => {
  let originalEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.clearAllMocks();
  });

  describe('default values', () => {
    test('should default to double newline when AGENT_TURN_SEPARATOR is not set', () => {
      delete process.env.AGENT_TURN_SEPARATOR;
      const config = new Config();
      expect(config.agentTurnSeparator).toBe('\n\n');
    });
  });

  describe('custom values', () => {
    test('should disable separator when set to empty string', () => {
      process.env.AGENT_TURN_SEPARATOR = '';
      const config = new Config();
      expect(config.agentTurnSeparator).toBe('');
    });

    test('should unescape \\n to actual newlines', () => {
      process.env.AGENT_TURN_SEPARATOR = '\\n';
      const config = new Config();
      expect(config.agentTurnSeparator).toBe('\n');
    });

    test('should unescape double \\n\\n to double newlines', () => {
      process.env.AGENT_TURN_SEPARATOR = '\\n\\n';
      const config = new Config();
      expect(config.agentTurnSeparator).toBe('\n\n');
    });

    test('should unescape \\t to actual tab', () => {
      process.env.AGENT_TURN_SEPARATOR = '\\t';
      const config = new Config();
      expect(config.agentTurnSeparator).toBe('\t');
    });

    test('should accept a plain text separator', () => {
      process.env.AGENT_TURN_SEPARATOR = ' --- ';
      const config = new Config();
      expect(config.agentTurnSeparator).toBe(' --- ');
    });

    test('should accept a space separator', () => {
      process.env.AGENT_TURN_SEPARATOR = ' ';
      const config = new Config();
      expect(config.agentTurnSeparator).toBe(' ');
    });

    test('should handle mixed text and escape sequences', () => {
      process.env.AGENT_TURN_SEPARATOR = '\\n---\\n';
      const config = new Config();
      expect(config.agentTurnSeparator).toBe('\n---\n');
    });
  });
});
