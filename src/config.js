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
const N8nApiModelLoader = require('./loaders/N8nApiModelLoader');
const StaticModelLoader = require('./loaders/StaticModelLoader');
const WebhookNotifier = require('./services/webhookNotifier');

// Registry of available model loaders
const MODEL_LOADERS = [JsonFileModelLoader, N8nApiModelLoader, StaticModelLoader];

class Config {
  constructor() {
    // Server configuration
    this.port = process.env.PORT || 3333;
    this.bearerToken = process.env.BEARER_TOKEN || '';
    this.n8nWebhookBearerToken = this.resolveN8nWebhookBearerToken();
    this.logRequests = process.env.LOG_REQUESTS === 'true';

    // Header configuration
    this.sessionIdHeaders = this.parseSessionIdHeaders();
    this.userIdHeaders = this.parseUserIdHeaders();
    this.userEmailHeaders = this.parseUserEmailHeaders();
    this.userNameHeaders = this.parseUserNameHeaders();
    this.userRoleHeaders = this.parseUserRoleHeaders();

    // Initialize ModelLoader (JsonFileModelLoader or N8nApiModelLoader)
    this.modelLoader = this.createModelLoader();

    // Initialize webhook notifier
    this.webhookNotifier = this.createWebhookNotifier();

    // Initialize models as empty object
    this.models = {};

    // Start async model loading
    // Server MUST wait for this promise to resolve before accepting requests
    this.loadingPromise = this.modelLoader
      .load()
      .then((models) => {
        this.models = models;
        console.log(`Models loaded: ${Object.keys(models).length} available`);

        // Notify webhook on startup if enabled
        if (this.webhookNotifier.enabled && this.webhookNotifier.notifyOnStartup) {
          const payload = WebhookNotifier.createPayload(
            models,
            this.modelLoader.constructor.name,
            WebhookNotifier.EventType.MODELS_LOADED,
          );
          this.webhookNotifier.notify(payload).catch(() => {
            console.warn(
              `[${new Date().toISOString()}] Webhook notification on startup failed, but models loaded successfully`,
            );
          });
        }

        return models;
      })
      .catch((error) => {
        console.error('Failed to load models:', error.message);
        throw error; // Propagate error to server startup
      });

    this.setupModelWatcher();
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
   * Validate and extract environment variables for a loader
   *
   * Uses the loader's getRequiredEnvVars() to determine which ENV vars are needed,
   * validates required ones, applies defaults for optional ones.
   * Returns raw ENV var values - the loader is responsible for mapping them
   * to its internal config structure.
   *
   * @param {Class} LoaderClass The loader class (must have static getRequiredEnvVars())
   * @returns {Object} Object with ENV var names as keys and their values
   * @throws {Error} If required environment variables are missing
   * @private
   */
  validateEnvVars(LoaderClass) {
    const envVarDefs = LoaderClass.getRequiredEnvVars();
    const envValues = {};
    const missing = [];

    for (const def of envVarDefs) {
      const value = process.env[def.name];

      if (!value || !value.trim()) {
        if (def.required) {
          missing.push(`${def.name} (${def.description})`);
        } else {
          // Use default value for optional vars
          envValues[def.name] = def.defaultValue;
        }
      } else {
        envValues[def.name] = value.trim();
      }
    }

    if (missing.length > 0) {
      const loaderType = process.env.MODEL_LOADER_TYPE || 'file';
      throw new Error(
        `Missing required environment variables for MODEL_LOADER_TYPE="${loaderType}":\n${missing
          .map((m) => `  - ${m}`)
          .join('\n')}`,
      );
    }

    return envValues;
  }

  /**
   * Create the appropriate ModelLoader instance based on MODEL_LOADER_TYPE
   *
   * Uses loader registry to find the matching loader class by TYPE.
   * Each loader defines its own static TYPE identifier.
   *
   * Steps:
   * 1. Read MODEL_LOADER_TYPE from ENV (default: "file")
   * 2. Find matching loader class in registry
   * 3. Validate required ENV vars via loader's getRequiredEnvVars()
   * 4. Create config object from ENV vars
   * 5. Inject config into loader constructor
   *
   * @returns {ModelLoader} Configured model loader instance
   * @throws {Error} If loader type is invalid or required ENV vars are missing
   */
  createModelLoader() {
    const loaderType = (process.env.MODEL_LOADER_TYPE || 'file').toLowerCase();

    // Find loader class by TYPE
    const LoaderClass = MODEL_LOADERS.find((loader) => loader.TYPE === loaderType);

    if (!LoaderClass) {
      const availableTypes = MODEL_LOADERS.map((l) => l.TYPE).join(', ');
      throw new Error(
        `Invalid MODEL_LOADER_TYPE: "${loaderType}". Available types: ${availableTypes}`,
      );
    }

    console.log(`Model Loader: ${LoaderClass.TYPE}`);

    // Validate env vars and pass to constructor
    // Loader is responsible for extracting and mapping ENV var values
    const envValues = this.validateEnvVars(LoaderClass);
    return new LoaderClass(envValues);
  }

  /**
   * Create and configure the WebhookNotifier
   * Only enabled if WEBHOOK_NOTIFIER_URL is set
   * @returns {WebhookNotifier} Configured notifier instance
   * @private
   */
  createWebhookNotifier() {
    const config = {
      webhookUrl: process.env.WEBHOOK_NOTIFIER_URL || null,
      timeout: parseInt(process.env.WEBHOOK_NOTIFIER_TIMEOUT || '5000', 10),
      maxRetries: parseInt(process.env.WEBHOOK_NOTIFIER_RETRIES || '3', 10),
      bearerToken: process.env.WEBHOOK_NOTIFIER_BEARER_TOKEN || null,
      notifyOnStartup: process.env.WEBHOOK_NOTIFIER_ON_STARTUP === 'true',
    };

    return new WebhookNotifier(config);
  }

  setupModelWatcher() {
    this.modelLoader.watch((newModels) => {
      console.log('Models changed, reloading...');
      this.models = newModels;
      console.log(`Models reloaded successfully (${Object.keys(newModels).length} models)`);

      // Notify webhook subscribers about model changes
      const payload = WebhookNotifier.createPayload(
        newModels,
        this.modelLoader.constructor.name,
        WebhookNotifier.EventType.MODELS_CHANGED,
      );
      this.webhookNotifier.notify(payload).catch(() => {
        console.warn(
          `[${new Date().toISOString()}] Webhook notification on model change failed, but models reloaded successfully`,
        );
      });
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

  async reloadModels() {
    const models = await this.modelLoader.load();
    this.models = models;
    return models;
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
