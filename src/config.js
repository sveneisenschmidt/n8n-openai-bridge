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
const JsonFileModelLoader = require('./loaders/JsonFileModelLoader');

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

    // Initialize ModelLoader (default: JsonFileModelLoader)
    this.modelLoader = this.createModelLoader();

    // Track loading promise to prevent race conditions
    this.loadingPromise = null;

    // Load models synchronously on startup to ensure they're available immediately
    try {
      this.models = this.modelLoader.loadSync();
    } catch (error) {
      console.error(`Error loading models: ${error.message}`);
      this.models = {};
    }

    this.setupFileWatcher();
  }

  /**
   * Create the appropriate ModelLoader instance
   * Default: JsonFileModelLoader for models.json
   * Can be extended to support other loaders based on env variables
   */
  createModelLoader() {
    // Default to JsonFileModelLoader
    return new JsonFileModelLoader(this.modelsConfigPath);
  }

  setupFileWatcher() {
    this.modelLoader.watch((newModels) => {
      this.models = newModels;
    });
  }

  close() {
    if (this.modelLoader) {
      this.modelLoader.stopWatching();
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
      .map((h) => h.trim())
      .filter((h) => h.length > 0);

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

  async loadModels() {
    // Prevent concurrent loads with promise tracking
    if (this.loadingPromise) {
      return this.loadingPromise;
    }

    this.loadingPromise = this.modelLoader
      .load()
      .then((models) => {
        this.models = models;
        console.log(`Models loaded successfully (${Object.keys(models).length} models)`);
        this.loadingPromise = null;
        return models;
      })
      .catch((error) => {
        console.error(`Error loading models: ${error.message}`);
        this.models = {};
        this.loadingPromise = null;
        throw error;
      });

    return this.loadingPromise;
  }

  async reloadModels() {
    // Use the same loadModels() to prevent race conditions
    return this.loadModels();
  }

  getModelWebhookUrl(modelId) {
    return this.models[modelId];
  }

  getAllModels() {
    return Object.keys(this.models).map((id) => ({
      id,
      object: 'model',
      created: Math.floor(Date.now() / 1000),
      owned_by: 'n8n',
    }));
  }
}

module.exports = new Config();
