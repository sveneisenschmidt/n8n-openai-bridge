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

const ModelLoader = require('./ModelLoader');

/**
 * Static model loader for testing
 *
 * Returns a fixed set of models provided in the constructor.
 * Useful for testing without file system or API dependencies.
 */
class StaticModelLoader extends ModelLoader {
  /**
   * Loader type identifier for MODEL_LOADER_TYPE env var
   */
  static TYPE = 'static';

  /**
   * Get required environment variables for this loader
   *
   * @returns {Array<{name: string, description: string, required: boolean, defaultValue?: string}>}
   */
  static getRequiredEnvVars() {
    return [
      {
        name: 'STATIC_MODELS',
        description: 'JSON string with static models for testing',
        required: false,
        defaultValue: '{}',
      },
    ];
  }

  /**
   * Constructor
   *
   * @param {Object} envValues Environment values object with ENV var names as keys
   */
  constructor(envValues) {
    super();
    const modelsJson = envValues.STATIC_MODELS || '{}';
    try {
      this.staticModels = JSON.parse(modelsJson);
    } catch (error) {
      throw new Error(`Invalid JSON in STATIC_MODELS: ${error.message}`);
    }
  }

  /**
   * Load static models
   *
   * @returns {Promise<Object>} Object with model_id -> webhook_url mapping
   */
  async load() {
    const validated = this.validateModels(this.staticModels);
    return validated;
  }
}

module.exports = StaticModelLoader;
