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
   * @returns {Object} Validated models object (with invalid entries filtered out)
   * @throws {Error} If models structure is completely invalid
   */
  validateModels(models) {
    if (!models || typeof models !== 'object' || Array.isArray(models)) {
      throw new Error('Models must be an object');
    }

    const validatedModels = {};

    for (const [modelId, webhookUrl] of Object.entries(models)) {
      // Skip invalid model IDs
      if (typeof modelId !== 'string' || !modelId.trim()) {
        console.warn(`Skipping invalid model ID: ${modelId}`);
        continue;
      }

      // Skip invalid webhook URLs
      if (typeof webhookUrl !== 'string' || !webhookUrl.trim()) {
        console.warn(`Skipping model "${modelId}": webhook URL must be a non-empty string`);
        continue;
      }

      // Basic URL validation
      try {
        new URL(webhookUrl);
        validatedModels[modelId] = webhookUrl;
      } catch {
        console.warn(`Skipping model "${modelId}": invalid webhook URL: ${webhookUrl}`);
      }
    }

    return validatedModels;
  }
}

module.exports = ModelLoader;
