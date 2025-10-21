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

const fs = require('fs');
const path = require('path');
const ModelLoader = require('./ModelLoader');

/**
 * Loads models from a JSON file
 *
 * This is the default and recommended model loader. It reads models from a JSON
 * configuration file (typically models.json) and supports hot-reload via file
 * watching.
 *
 * File Format Example:
 * ```json
 * {
 *   "model-1": "https://n8n.example.com/webhook/abc123/chat",
 *   "model-2": "https://n8n.example.com/webhook/xyz789/chat"
 * }
 * ```
 *
 * Lifecycle:
 * 1. Startup: loadSync() called by config, blocks until file is read
 * 2. Hot-reload: watch() sets up file system watcher
 * 3. File change detected → 100ms debounce → reload() → callback fired
 * 4. Shutdown: stopWatching() cleans up watcher and timers
 *
 * Error Handling Strategy:
 * - File not found: Throws error (application should handle)
 * - Invalid JSON: Throws error with helpful message
 * - Invalid models: Filtered out with warnings (graceful degradation)
 * - Watch setup failure: Logs warning but doesn't throw (still usable without watch)
 *
 * Performance Considerations:
 * - loadSync() is blocking (OK for startup, small files)
 * - Suitable for files < 10MB (typical models.json is < 1KB)
 * - watch() uses fs.watch() which is efficient and cross-platform
 * - Debounce delay (100ms) prevents reload storms on rapid file changes
 */
class JsonFileModelLoader extends ModelLoader {
  /**
   * Loader type identifier for MODEL_LOADER_TYPE env var
   */
  static TYPE = 'file';

  /**
   * Get required environment variables for this loader
   *
   * @returns {Array<{name: string, description: string, required: boolean, defaultValue?: string}>}
   */
  static getRequiredEnvVars() {
    return [
      {
        name: 'MODELS_CONFIG',
        description: 'Path to models.json file',
        required: false,
        defaultValue: './models.json',
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

    // Extract filePath from MODELS_CONFIG env var
    const filePath = envValues.MODELS_CONFIG;

    // Always convert to absolute path for consistency and debugging
    this.filePath = path.resolve(filePath);
    this.watcher = null;
    this.watchCallback = null;
    this.reloadTimeout = null;

    console.log(`JsonFileModelLoader: Using file ${this.filePath}`);
  }

  /**
   * Load models from the JSON file synchronously
   *
   * Implementation Flow:
   * 1. Read file synchronously (blocks execution)
   * 2. Parse JSON (throws if invalid)
   * 3. Call validateModels() to filter/validate entries
   * 4. Return validated models object
   *
   * Error Handling:
   * - File not found (ENOENT): Throw descriptive error
   * - Invalid JSON (SyntaxError): Throw with original error message
   * - Invalid models: Not thrown here, validateModels() filters gracefully
   * - Permission denied: Let error bubble up (file system issue, not model issue)
   *
   * @returns {Object} Object with model_id -> webhook_url mapping
   * @throws {Error} If file not found or JSON is invalid
   */
  loadSync() {
    try {
      // Read file synchronously - blocks until complete
      // Note: For startup, this is acceptable. For large files, consider async load()
      const data = fs.readFileSync(this.filePath, 'utf8');

      // Parse JSON - throws SyntaxError if invalid
      const models = JSON.parse(data);

      // Validate and filter models (graceful degradation)
      // Invalid entries logged as warnings, not thrown
      const validatedModels = this.validateModels(models);

      return validatedModels;
    } catch (error) {
      // Specific error handling for common issues
      if (error.code === 'ENOENT') {
        throw new Error(`Models file not found: ${this.filePath}`);
      } else if (error instanceof SyntaxError) {
        // Include original error message to help debugging
        throw new Error(`Invalid JSON in models file: ${error.message}`);
      }
      // Other errors (permissions, etc) bubble up unchanged
      throw error;
    }
  }

  /**
   * Load models from the JSON file (async wrapper)
   *
   * Contract: Fulfills ModelLoader interface by providing async load().
   * Implementation: Delegates to loadSync() for now.
   *
   * Future Enhancement: Could support async sources (databases, remote APIs)
   *
   * @returns {Promise<Object>} Object with model_id -> webhook_url mapping
   * @throws {Error} Same errors as loadSync()
   */
  async load() {
    return this.loadSync();
  }

  /**
   * Watch the JSON file for changes and reload automatically
   *
   * This enables hot-reload: changes to models.json are automatically detected
   * and loaded without restarting the application.
   *
   * Watch Flow:
   * 1. File system emits 'change' event (may emit multiple times)
   * 2. Clear any pending reload timeout (debounce)
   * 3. Start new 100ms timeout
   * 4. Timeout fires → load() → validateModels() → callback fires
   * 5. Callback receives new models, config updates in-memory
   *
   * Why Debounce (100ms)?
   * - File systems often emit multiple events for a single write
   * - Without debounce: 5+ reloads for one file write
   * - 100ms window: Batches events into single reload
   * - 100ms is short enough for perceived "instant" reload
   * - 100ms is long enough for multiple events to batch
   *
   * Error Handling:
   * - Invalid models (bad URL, etc): Logged as warnings, not thrown
   * - File deleted during watch: Error logged, callback not fired
   * - File permission changed: Watcher continues, error on next reload
   * - Watch setup failure: Logged but doesn't throw (graceful degradation)
   *
   * Platform Notes:
   * - fs.watch() uses OS-level file system notifications (most efficient)
   * - Cross-platform but behavior may vary (some OS batch events differently)
   * - Not 100% reliable on network filesystems (but rare use case)
   *
   * @param {Function} callback Function to call when models change
   *                            Signature: (models: Object) => void
   *                            Receives new models object
   */
  watch(callback) {
    // Prevent double-watch (could cause multiple reloads)
    if (this.watcher) {
      console.warn(`Already watching ${this.filePath}`);
      return;
    }

    this.watchCallback = callback;

    try {
      // Set up file system watcher
      this.watcher = fs.watch(this.filePath, (eventType) => {
        // Only handle 'change' events (ignore 'rename' events)
        if (eventType === 'change') {
          // Debounce mechanism: clear previous timeout and start new one
          // This batches rapid file changes into a single reload
          clearTimeout(this.reloadTimeout);
          this.reloadTimeout = setTimeout(async () => {
            console.log(`${this.filePath} changed, reloading...`);
            try {
              // Load and validate new models
              const models = await this.load();
              console.log(`Models reloaded successfully (${Object.keys(models).length} models)`);

              // Notify config about the change
              if (this.watchCallback) {
                this.watchCallback(models);
              }
            } catch (error) {
              // Log error but don't throw - watcher continues running
              // This allows fixing the file and it will reload on next save
              console.error(`Error reloading models: ${error.message}`);
            }
          }, 100); // 100ms debounce window
        }
      });
      console.log(`Watching ${this.filePath} for changes...`);
    } catch (error) {
      // Watch setup failed - log but don't throw
      // Application can still use loader without hot-reload
      console.warn(`Could not watch ${this.filePath}: ${error.message}`);
    }
  }

  /**
   * Stop watching the file for changes
   *
   * Called during application shutdown to cleanup resources.
   *
   * Cleanup Steps:
   * 1. Clear any pending reload timeout
   * 2. Close file system watcher
   * 3. Nullify all references
   *
   * Safe to call multiple times (idempotent).
   */
  stopWatching() {
    // Clear any pending reload timeout
    if (this.reloadTimeout) {
      clearTimeout(this.reloadTimeout);
      this.reloadTimeout = null;
    }

    // Close file system watcher if active
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
      this.watchCallback = null;
      console.log(`Stopped watching ${this.filePath}`);
    }
  }
}

module.exports = JsonFileModelLoader;
