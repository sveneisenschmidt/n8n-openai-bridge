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

const axios = require('axios');
const ModelLoader = require('./ModelLoader');

/**
 * Loads models from a JSON HTTP endpoint
 *
 * This loader enables fetching OpenAI models from any HTTP(S) endpoint
 * that returns a JSON object with the format: { "modelId": "webhookUrl", ... }
 *
 * Features:
 * - HTTP(S) endpoint fetching with configurable timeout
 * - No authentication support (starts without auth, future enhancement)
 * - Polling mechanism for auto-reload
 * - Hash-based change detection
 *
 * Architecture:
 * 1. Fetch JSON from configured HTTP endpoint
 * 2. Parse JSON response
 * 3. Validate models using base class
 * 4. Optional: Poll for changes at configured interval
 *
 * Expected Response Format:
 * {
 *   "model-id-1": "https://webhook.example.com/path1",
 *   "model-id-2": "https://webhook.example.com/path2"
 * }
 *
 * Error Handling:
 * - Startup errors: Propagated to caller (server won't start)
 * - Polling errors: Logged but don't stop polling
 * - Invalid models: Filtered out with warnings (graceful degradation)
 * - Network errors: Detailed error messages with context
 *
 * Future Enhancements:
 * - Bearer token authentication
 * - Custom headers support
 * - Request/response transformation
 * - Rate limiting on polling
 */
class JsonHttpModelLoader extends ModelLoader {
  /**
   * Loader type identifier for MODEL_LOADER_TYPE env var
   */
  static TYPE = 'json-http';

  /**
   * Get required environment variables for this loader
   *
   * @returns {Array<{name: string, description: string, required: boolean, defaultValue?: string}>}
   */
  static getRequiredEnvVars() {
    return [
      {
        name: 'JSON_HTTP_ENDPOINT',
        description: 'HTTP(S) endpoint URL that returns JSON models config',
        required: true,
      },
      {
        name: 'JSON_HTTP_POLL_INTERVAL',
        description: 'Polling interval in seconds (0=disabled, 60-600)',
        required: false,
        defaultValue: '300',
      },
      {
        name: 'JSON_HTTP_TIMEOUT',
        description: 'HTTP request timeout in milliseconds',
        required: false,
        defaultValue: '10000',
      },
    ];
  }

  /**
   * Constructor
   *
   * @param {Object} envValues Object with environment variable values
   */
  constructor(envValues) {
    super();

    // Extract values from environment variables
    const endpoint = envValues.JSON_HTTP_ENDPOINT;
    const pollingIntervalStr = envValues.JSON_HTTP_POLL_INTERVAL;
    const timeoutStr = envValues.JSON_HTTP_TIMEOUT;

    // Validate endpoint URL
    try {
      this.endpoint = new URL(endpoint).toString(); // Validates and normalizes URL
    } catch {
      throw new Error(`Invalid JSON_HTTP_ENDPOINT URL: ${endpoint}`);
    }

    // Parse timeout to number
    const timeout = parseInt(timeoutStr, 10);
    if (isNaN(timeout) || timeout < 1000) {
      throw new Error('JSON_HTTP_TIMEOUT must be >= 1000 milliseconds');
    }
    this.timeout = timeout;

    // Parse polling interval to number
    const pollingInterval = parseInt(pollingIntervalStr, 10);

    // Validate polling interval (60-600 seconds, or 0 to disable)
    if (pollingInterval < 0 || isNaN(pollingInterval)) {
      throw new Error('Polling interval must be >= 0');
    }
    if (pollingInterval > 0 && pollingInterval < 60) {
      console.warn(`Polling interval ${pollingInterval}s is too low, setting to 60s`);
      this.pollingInterval = 60;
    } else if (pollingInterval > 600) {
      console.warn(`Polling interval ${pollingInterval}s is too high, setting to 600s`);
      this.pollingInterval = 600;
    } else {
      this.pollingInterval = pollingInterval;
    }

    console.log(
      `JsonHttpModelLoader: Fetching from ${this.endpoint} (timeout: ${this.timeout}ms, poll: ${this.pollingInterval}s)`,
    );

    // Polling state
    this.pollingTimer = null;
    this.watchCallback = null;

    // Configure axios instance for HTTP endpoint
    this.axiosInstance = axios.create({
      timeout: this.timeout,
    });
  }

  /**
   * Load models from HTTP endpoint
   *
   * Implementation Flow:
   * 1. Fetch JSON from HTTP endpoint
   * 2. Validate response is a JSON object
   * 3. Validate models using base class
   * 4. Return validated models
   *
   * @returns {Promise<Object>} Object with model_id -> webhook_url mapping
   * @throws {Error} If HTTP request fails or response is invalid
   */
  async load() {
    try {
      // Fetch JSON from HTTP endpoint
      const response = await this.axiosInstance.get(this.endpoint);

      // Validate response is object (not array, null, or other type)
      if (!response.data || typeof response.data !== 'object' || Array.isArray(response.data)) {
        throw new Error('Response must be a JSON object');
      }

      console.log(`Fetched models from HTTP endpoint: ${this.endpoint}`);

      // Validate models using base class (graceful degradation)
      const validatedModels = this.validateModels(response.data);

      console.log(`Loaded ${Object.keys(validatedModels).length} models from HTTP endpoint`);

      return validatedModels;
    } catch (error) {
      // Enhance error message with context
      if (error.response) {
        // HTTP error from endpoint
        const status = error.response.status;
        const message = error.response.data?.message || error.message;

        if (status === 401) {
          throw new Error(`HTTP endpoint returned 401 Unauthorized: ${this.endpoint}`);
        } else if (status === 403) {
          throw new Error(`HTTP endpoint returned 403 Forbidden: ${this.endpoint}`);
        } else if (status === 404) {
          throw new Error(`HTTP endpoint returned 404 Not Found: ${this.endpoint}`);
        } else {
          throw new Error(`HTTP endpoint error (${status}): ${message}`);
        }
      } else if (error.request) {
        // Network error (no response received)
        throw new Error(`Cannot reach HTTP endpoint at ${this.endpoint}: ${error.message}`);
      } else if (error.message === 'Response must be a JSON object') {
        // Response format error
        throw new Error(`Invalid response from ${this.endpoint}: ${error.message}`);
      } else {
        // Other errors (validation, etc)
        throw error;
      }
    }
  }

  /**
   * Watch for changes by polling HTTP endpoint at configured interval
   *
   * Polling Flow:
   * 1. Start timer with configured interval
   * 2. On timer: fetch JSON → validate → compare hash
   * 3. If hash changed: notify callback with new models
   * 4. On error: log but continue polling (don't give up on temporary failures)
   * 5. Repeat until stopWatching() is called
   *
   * Change Detection:
   * - Uses hash-based comparison (consistent with other loaders)
   * - Only fires callback when models actually change
   * - Prevents unnecessary reloads and webhook notifications
   *
   * Polling is disabled when pollingInterval = 0
   *
   * @param {Function} callback Function to call when models change
   *                            Signature: (models: Object) => void
   */
  watch(callback) {
    if (this.pollingInterval === 0) {
      console.log('Polling disabled (JSON_HTTP_POLL_INTERVAL=0)');
      return;
    }

    if (this.pollingTimer) {
      console.warn('Polling already active');
      return;
    }

    this.watchCallback = callback;

    console.log(`Starting polling every ${this.pollingInterval}s for HTTP endpoint`);

    // Start polling timer
    this.pollingTimer = setInterval(async () => {
      console.log('Polling for model changes...');
      try {
        const models = await this.load();

        // Calculate hash of current models
        const currentHash = this.getModelsHash(models);

        // Check if models changed
        if (currentHash !== this.lastHash) {
          // Update hash
          this.lastHash = currentHash;

          // Notify callback about new models
          if (this.watchCallback) {
            this.watchCallback(models);
          }
        }
      } catch (error) {
        // Log error but don't stop polling
        // This allows recovery from temporary failures (network issues, endpoint down, etc)
        console.error(`Polling error: ${error.message}`);
      }
    }, this.pollingInterval * 1000); // Convert seconds to milliseconds
  }

  /**
   * Stop polling for changes
   *
   * Called during application shutdown to cleanup resources.
   * Clears polling timer, callback reference, and hash state.
   *
   * Safe to call multiple times (idempotent).
   */
  stopWatching() {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
      this.watchCallback = null;
      this.lastHash = null;
      console.log('Stopped polling HTTP endpoint');
    }
  }
}

module.exports = JsonHttpModelLoader;
