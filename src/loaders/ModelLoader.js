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
 * Base class for model loaders
 * Provides interface for loading models from different sources
 */
class ModelLoader {
  /**
   * Load models from the configured source
   * @returns {Promise<Object>} Object with model_id -> webhook_url mapping
   */
  async load() {
    throw new Error('load() must be implemented by subclass');
  }

  /**
   * Watch for changes and reload models automatically
   * @param {Function} _callback Function to call when models change
   */
  watch(_callback) {
    // Optional: implement in subclass if watching is supported
  }

  /**
   * Stop watching for changes
   */
  stopWatching() {
    // Optional: implement in subclass if watching is supported
  }

  /**
   * Validate the loaded models structure
   * @param {Object} models Models object to validate
   * @returns {boolean} True if valid
   * @throws {Error} If validation fails
   */
  validateModels(models) {
    if (!models || typeof models !== 'object' || Array.isArray(models)) {
      throw new Error('Models must be an object');
    }

    for (const [modelId, webhookUrl] of Object.entries(models)) {
      if (typeof modelId !== 'string' || !modelId.trim()) {
        throw new Error('Model ID must be a non-empty string');
      }

      if (typeof webhookUrl !== 'string' || !webhookUrl.trim()) {
        throw new Error(`Webhook URL for model "${modelId}" must be a non-empty string`);
      }

      // Basic URL validation
      try {
        new URL(webhookUrl);
      } catch {
        throw new Error(`Invalid webhook URL for model "${modelId}": ${webhookUrl}`);
      }
    }

    return true;
  }
}

module.exports = ModelLoader;
