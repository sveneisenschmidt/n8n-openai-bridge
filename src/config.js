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
const fs = require('fs');
const path = require('path');

class Config {
  constructor() {
    this.port = process.env.PORT || 3333;
    this.bearerToken = process.env.BEARER_TOKEN || '';
    this.n8nBearerToken = process.env.N8N_BEARER_TOKEN || '';
    this.modelsConfigPath = process.env.MODELS_CONFIG || './models.json';
    this.logRequests = process.env.LOG_REQUESTS === 'true';
    this.sessionIdHeaders = this.parseSessionIdHeaders();
    this.userIdHeaders = this.parseUserIdHeaders();
    this.userEmailHeaders = this.parseUserEmailHeaders();
    this.userNameHeaders = this.parseUserNameHeaders();
    this.userRoleHeaders = this.parseUserRoleHeaders();
    this.models = this.loadModels();
    this.watcher = null;
    this.setupFileWatcher();
  }

  setupFileWatcher() {
    const configPath = path.resolve(this.modelsConfigPath);
    let reloadTimeout = null;

    try {
      this.watcher = fs.watch(configPath, (eventType) => {
        if (eventType === 'change') {
          // Debounce: wait 100ms before reloading to avoid multiple reloads
          clearTimeout(reloadTimeout);
          reloadTimeout = setTimeout(() => {
            console.log(`[${new Date().toISOString()}] models.json changed, reloading...`);
            this.reloadModels();
            console.log(`[${new Date().toISOString()}] Models reloaded successfully (${Object.keys(this.models).length} models)`);
          }, 100);
        }
      });
      console.log(`[${new Date().toISOString()}] Watching ${configPath} for changes...`);
    } catch (error) {
      console.warn(`[${new Date().toISOString()}] Could not watch models.json: ${error.message}`);
    }
  }

  close() {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
  }

  parseHeadersFromEnv(envVarName, defaultHeaders) {
    const envValue = process.env[envVarName];

    if (!envValue || !envValue.trim()) {
      return defaultHeaders;
    }

    // Split by comma, trim whitespace, filter empty values
    const headers = envValue
      .split(',')
      .map(h => h.trim())
      .filter(h => h.length > 0);

    return headers.length > 0 ? headers : defaultHeaders;
  }

  parseSessionIdHeaders() {
    return this.parseHeadersFromEnv('SESSION_ID_HEADERS', ['X-Session-Id', 'X-Chat-Id']);
  }

  parseUserIdHeaders() {
    return this.parseHeadersFromEnv('USER_ID_HEADERS', ['X-User-Id']);
  }

  parseUserEmailHeaders() {
    return this.parseHeadersFromEnv('USER_EMAIL_HEADERS', ['X-User-Email']);
  }

  parseUserNameHeaders() {
    return this.parseHeadersFromEnv('USER_NAME_HEADERS', ['X-User-Name']);
  }

  parseUserRoleHeaders() {
    return this.parseHeadersFromEnv('USER_ROLE_HEADERS', ['X-User-Role']);
  }

  loadModels() {
    try {
      const configPath = path.resolve(this.modelsConfigPath);
      const data = fs.readFileSync(configPath, 'utf8');
      const models = JSON.parse(data);
      return models;
    } catch (error) {
      console.error('Error loading models config:', error.message);
      return {};
    }
  }

  reloadModels() {
    this.models = this.loadModels();
  }

  getModelWebhookUrl(modelId) {
    return this.models[modelId];
  }

  getAllModels() {
    return Object.keys(this.models).map(id => ({
      id,
      object: 'model',
      created: Math.floor(Date.now() / 1000),
      owned_by: 'n8n',
    }));
  }
}

module.exports = new Config();
