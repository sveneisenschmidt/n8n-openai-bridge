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

require('dotenv').config();

/**
 * Config - Pure Configuration Class
 *
 * Responsibilities:
 * - Parse environment variables
 * - Server settings (port, bearer tokens, logging)
 * - Header configurations (session, user context)
 * - Helper methods for parsing
 *
 * Does NOT:
 * - Create ModelLoader instances (see ModelLoaderFactory)
 * - Manage model state (see ModelRepository)
 * - Orchestrate lifecycle (see Bootstrap)
 */
class Config {
  constructor() {
    // Server configuration
    this.port = process.env.PORT || 3333;
    this.bearerToken = process.env.BEARER_TOKEN || '';
    this.n8nWebhookBearerToken = this.resolveN8nWebhookBearerToken();
    this.logRequests = process.env.LOG_REQUESTS === 'true';

    // Task detection configuration
    this.enableTaskDetection = process.env.ENABLE_TASK_DETECTION === 'true';

    // Header configuration
    this.sessionIdHeaders = this.parseSessionIdHeaders();
    this.userIdHeaders = this.parseUserIdHeaders();
    this.userEmailHeaders = this.parseUserEmailHeaders();
    this.userNameHeaders = this.parseUserNameHeaders();
    this.userRoleHeaders = this.parseUserRoleHeaders();
  }

  /**
   * Resolve n8n webhook bearer token with backwards compatibility
   * Prefers N8N_WEBHOOK_BEARER_TOKEN, falls back to N8N_BEARER_TOKEN (deprecated)
   * @returns {string} The resolved bearer token or empty string
   */
  resolveN8nWebhookBearerToken() {
    // Prefer new name
    if (process.env.N8N_WEBHOOK_BEARER_TOKEN) {
      return process.env.N8N_WEBHOOK_BEARER_TOKEN;
    }

    // Fall back to old name for backwards compatibility
    if (process.env.N8N_BEARER_TOKEN) {
      console.warn('N8N_BEARER_TOKEN is deprecated, please use N8N_WEBHOOK_BEARER_TOKEN instead');
      return process.env.N8N_BEARER_TOKEN;
    }

    return '';
  }

  /**
   * Parse comma-separated headers from environment variable
   * @param {string} envVarName - Name of the environment variable
   * @param {string[]} defaultHeaders - Default headers if env var not set
   * @returns {string[]} Array of header names
   * @private
   */
  parseHeadersFromEnv(envVarName, defaultHeaders) {
    const envValue = process.env[envVarName];

    if (!envValue || !envValue.trim()) {
      return defaultHeaders;
    }

    // Split by comma, trim whitespace, filter empty values
    const headers = envValue
      .split(',')
      .map((h) => h.trim())
      .filter((h) => h.length > 0);

    return headers.length > 0 ? headers : defaultHeaders;
  }

  /**
   * Parse session ID headers from SESSION_ID_HEADERS env var
   * @returns {string[]} Array of session ID header names
   */
  parseSessionIdHeaders() {
    return this.parseHeadersFromEnv('SESSION_ID_HEADERS', ['X-Session-Id', 'X-Chat-Id']);
  }

  /**
   * Parse user ID headers from USER_ID_HEADERS env var
   * @returns {string[]} Array of user ID header names
   */
  parseUserIdHeaders() {
    return this.parseHeadersFromEnv('USER_ID_HEADERS', ['X-User-Id']);
  }

  /**
   * Parse user email headers from USER_EMAIL_HEADERS env var
   * @returns {string[]} Array of user email header names
   */
  parseUserEmailHeaders() {
    return this.parseHeadersFromEnv('USER_EMAIL_HEADERS', ['X-User-Email']);
  }

  /**
   * Parse user name headers from USER_NAME_HEADERS env var
   * @returns {string[]} Array of user name header names
   */
  parseUserNameHeaders() {
    return this.parseHeadersFromEnv('USER_NAME_HEADERS', ['X-User-Name']);
  }

  /**
   * Parse user role headers from USER_ROLE_HEADERS env var
   * @returns {string[]} Array of user role header names
   */
  parseUserRoleHeaders() {
    return this.parseHeadersFromEnv('USER_ROLE_HEADERS', ['X-User-Role']);
  }
}

module.exports = Config;
