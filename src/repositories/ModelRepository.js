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
 * ModelRepository - Model State & Query Layer
 *
 * Responsibilities:
 * - Manage model state (in-memory cache)
 * - Provide query methods for models
 * - Handle model reloading
 *
 * Does NOT:
 * - Create ModelLoader instances (see ModelLoaderFactory)
 * - Parse configuration (see Config)
 * - Orchestrate lifecycle (see Bootstrap)
 */
class ModelRepository {
  constructor() {
    /**
     * In-memory model cache
     * Format: { "model-id": "https://webhook-url", ... }
     * @type {Object<string, string>}
     */
    this.models = {};
  }

  /**
   * Get webhook URL for a specific model
   * @param {string} modelId - The model identifier
   * @returns {string|undefined} The webhook URL or undefined if model not found
   */
  getModelWebhookUrl(modelId) {
    return this.models[modelId];
  }

  /**
   * Get all models in OpenAI-compatible format
   * @returns {Array<Object>} Array of model objects
   */
  getAllModels() {
    return Object.keys(this.models).map((id) => ({
      id,
      object: 'model',
      created: Math.floor(Date.now() / 1000),
      owned_by: 'n8n',
    }));
  }

  /**
   * Reload models from a loader
   * @param {ModelLoader} modelLoader - The loader to use
   * @returns {Promise<Object>} The loaded models
   */
  async reloadModels(modelLoader) {
    const models = await modelLoader.load();
    this.models = models;
    return models;
  }

  /**
   * Update models (used by watcher callbacks)
   * @param {Object<string, string>} models - New models object
   */
  updateModels(models) {
    this.models = models;
  }

  /**
   * Get count of loaded models
   * @returns {number} Number of models
   */
  getModelCount() {
    return Object.keys(this.models).length;
  }

  /**
   * Check if a model exists
   * @param {string} modelId - The model identifier
   * @returns {boolean} True if model exists
   */
  hasModel(modelId) {
    return modelId in this.models;
  }
}

module.exports = ModelRepository;
