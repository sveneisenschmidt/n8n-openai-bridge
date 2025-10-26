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

/**
 * BACKWARDS COMPATIBILITY WRAPPER
 *
 * This file maintains backwards compatibility with the old monolithic Config class.
 * It wraps Bootstrap and exposes the old API surface.
 *
 * For new code, use Bootstrap directly instead of this wrapper.
 * This wrapper exists only to support existing tests and legacy integrations.
 *
 * @deprecated Use Bootstrap directly for new code
 */

const Bootstrap = require('./Bootstrap');

/**
 * Legacy Config class - wraps Bootstrap for backwards compatibility
 * Provides the same interface as the old monolithic Config class
 */
class LegacyConfigWrapper {
  constructor() {
    this._bootstrap = new Bootstrap();

    // Proxy all Config properties
    this.port = this._bootstrap.config.port;
    this.bearerToken = this._bootstrap.config.bearerToken;
    this.n8nWebhookBearerToken = this._bootstrap.config.n8nWebhookBearerToken;
    this.logRequests = this._bootstrap.config.logRequests;
    this.sessionIdHeaders = this._bootstrap.config.sessionIdHeaders;
    this.userIdHeaders = this._bootstrap.config.userIdHeaders;
    this.userEmailHeaders = this._bootstrap.config.userEmailHeaders;
    this.userNameHeaders = this._bootstrap.config.userNameHeaders;
    this.userRoleHeaders = this._bootstrap.config.userRoleHeaders;

    // Proxy loadingPromise - this is what old tests expect
    this.loadingPromise = this._bootstrap.initialize().then(() => {
      return this._bootstrap.modelRepository.models;
    });
  }

  /**
   * Get models object (legacy interface)
   * @returns {Object} Models object
   */
  get models() {
    return this._bootstrap.modelRepository.models;
  }

  /**
   * Set models object (legacy interface)
   * @param {Object} models - Models object
   */
  set models(models) {
    this._bootstrap.modelRepository.models = models;
  }

  /**
   * Get model loader (legacy interface)
   * @returns {ModelLoader} Model loader instance
   */
  get modelLoader() {
    return this._bootstrap.modelLoader;
  }

  /**
   * Get webhook notifier (legacy interface)
   * @returns {WebhookNotifier} Webhook notifier instance
   */
  get webhookNotifier() {
    return this._bootstrap.webhookNotifier;
  }

  /**
   * Get model webhook URL (legacy interface)
   * @param {string} modelId - Model identifier
   * @returns {string|undefined} Webhook URL
   */
  getModelWebhookUrl(modelId) {
    return this._bootstrap.modelRepository.getModelWebhookUrl(modelId);
  }

  /**
   * Get all models (legacy interface)
   * @returns {Array<Object>} Array of model objects
   */
  getAllModels() {
    return this._bootstrap.modelRepository.getAllModels();
  }

  /**
   * Reload models (legacy interface)
   * @returns {Promise<Object>} Loaded models
   */
  async reloadModels() {
    return this._bootstrap.modelRepository.reloadModels(this._bootstrap.modelLoader);
  }

  /**
   * Close and cleanup (legacy interface)
   */
  close() {
    this._bootstrap.close();
  }

  /**
   * Parse headers from environment (legacy interface)
   * @param {string} envVarName - Environment variable name
   * @param {string[]} defaultHeaders - Default headers
   * @returns {string[]} Parsed headers
   */
  parseHeadersFromEnv(envVarName, defaultHeaders) {
    return this._bootstrap.config.parseHeadersFromEnv(envVarName, defaultHeaders);
  }

  /**
   * Parse session ID headers (legacy interface)
   * @returns {string[]} Session ID headers
   */
  parseSessionIdHeaders() {
    return this._bootstrap.config.parseSessionIdHeaders();
  }

  /**
   * Parse user ID headers (legacy interface)
   * @returns {string[]} User ID headers
   */
  parseUserIdHeaders() {
    return this._bootstrap.config.parseUserIdHeaders();
  }

  /**
   * Parse user email headers (legacy interface)
   * @returns {string[]} User email headers
   */
  parseUserEmailHeaders() {
    return this._bootstrap.config.parseUserEmailHeaders();
  }

  /**
   * Parse user name headers (legacy interface)
   * @returns {string[]} User name headers
   */
  parseUserNameHeaders() {
    return this._bootstrap.config.parseUserNameHeaders();
  }

  /**
   * Parse user role headers (legacy interface)
   * @returns {string[]} User role headers
   */
  parseUserRoleHeaders() {
    return this._bootstrap.config.parseUserRoleHeaders();
  }

  /**
   * Resolve n8n webhook bearer token (legacy interface)
   * @returns {string} Bearer token
   */
  resolveN8nWebhookBearerToken() {
    return this._bootstrap.config.resolveN8nWebhookBearerToken();
  }
}

// Export singleton instance for backwards compatibility
module.exports = new LegacyConfigWrapper();
