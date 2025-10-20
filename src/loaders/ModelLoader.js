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
 *
 * Provides a flexible interface for loading models from different sources.
 * This architecture allows the bridge to support multiple model sources:
 * - JSON files (JsonFileModelLoader)
 * - Databases
 * - Remote configuration servers
 * - Environment variables
 * etc.
 *
 * Subclasses MUST implement:
 * - load() - Load and return models
 * - validateModels() uses graceful degradation: invalid entries are filtered
 *   out with warnings rather than failing the entire load. This ensures the
 *   bridge continues running even with partially invalid configurations.
 *
 * Subclasses MAY implement:
 * - watch() - Watch for changes and reload automatically
 * - stopWatching() - Cleanup watcher resources
 */
class ModelLoader {
  /**
   * Load models from the configured source
   *
   * MUST be implemented by subclass.
   *
   * Contract:
   * - Returns a promise that resolves to models object
   * - Models object: { "model-id": "https://webhook-url", ... }
   * - MUST call validateModels() on loaded data
   * - MUST throw descriptive errors on failure
   * - SHOULD handle source-specific errors (file not found, permission denied, etc)
   *
   * @returns {Promise<Object>} Object with model_id -> webhook_url mapping
   * @throws {Error} With descriptive message if loading fails
   */
  async load() {
    throw new Error('load() must be implemented by subclass');
  }

  /**
   * Watch for changes and reload models automatically (optional)
   *
   * Called by config to enable hot-reload functionality.
   * Not all sources support watching (e.g., remote APIs).
   *
   * Contract:
   * - If watching is not supported, this method should not throw
   * - Call the provided callback whenever models change
   * - Callback receives new models object as parameter
   * - Should handle errors gracefully (log but don't throw)
   *
   * @param {Function} _callback Function to call when models change, signature: (models) => void
   */
  watch(_callback) {
    // Optional: implement in subclass if watching is supported
  }

  /**
   * Stop watching for changes (optional)
   *
   * Called during application shutdown to cleanup resources.
   * Must clear all listeners and timers.
   */
  stopWatching() {
    // Optional: implement in subclass if watching is supported
  }

  /**
   * Validate the loaded models structure
   *
   * Uses GRACEFUL DEGRADATION strategy:
   * - Invalid entries are filtered out with console.warn() messages
   * - Server continues running with partial model set
   * - This prevents one bad model from blocking the entire service
   *
   * Validation checks:
   * 1. Root level: Must be a plain object (not array, null, etc)
   * 2. Model IDs: Must be non-empty strings
   * 3. Webhook URLs: Must be non-empty strings
   * 4. URL format: Must be valid HTTP/HTTPS URLs (uses URL constructor)
   *
   * Why URL constructor vs regex?
   * - URL constructor handles edge cases and international domains correctly
   * - More maintainable and less error-prone than complex regex
   * - Matches browser URL validation behavior
   *
   * @param {Object} models Models object to validate
   * @returns {Object} Validated models object (with invalid entries filtered out)
   * @throws {Error} Only if root structure is invalid (not an object)
   */
  validateModels(models) {
    // Reject completely invalid root structures
    if (!models || typeof models !== 'object' || Array.isArray(models)) {
      throw new Error('Models must be an object');
    }

    const validatedModels = {};

    for (const [modelId, webhookUrl] of Object.entries(models)) {
      // Skip invalid model IDs (graceful degradation)
      if (typeof modelId !== 'string' || !modelId.trim()) {
        console.warn(`Skipping invalid model ID: ${modelId}`);
        continue;
      }

      // Skip invalid webhook URLs (graceful degradation)
      if (typeof webhookUrl !== 'string' || !webhookUrl.trim()) {
        console.warn(`Skipping model "${modelId}": webhook URL must be a non-empty string`);
        continue;
      }

      // Validate URL format using URL constructor
      // Only accepts valid HTTP/HTTPS URLs
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
