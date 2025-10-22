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
const crypto = require('crypto');
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
        name: 'MODELS_CONFIG_FILE',
        description: 'Path to models.json file',
        required: false,
        defaultValue: './models.json',
      },
      {
        name: 'MODELS_CONFIG',
        description: 'Path to models.json file (deprecated, use MODELS_CONFIG_FILE)',
        required: false,
        defaultValue: null,
      },
      {
        name: 'MODELS_POLL_INTERVAL',
        description: 'File watch polling interval in seconds',
        required: false,
        defaultValue: '1',
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

    // Prefer MODELS_CONFIG_FILE, fall back to MODELS_CONFIG (deprecated)
    let filePath = envValues.MODELS_CONFIG_FILE;

    if (!filePath && envValues.MODELS_CONFIG) {
      console.warn('MODELS_CONFIG is deprecated, please use MODELS_CONFIG_FILE instead');
      filePath = envValues.MODELS_CONFIG;
    }

    // Always convert to absolute path for consistency and debugging
    this.filePath = path.resolve(filePath);
    this.pollingInterval = null;
    this.watchCallback = null;
    this.lastHash = null;

    // Watch interval from env or default (in seconds, convert to milliseconds)
    const watchIntervalEnv = envValues.MODELS_POLL_INTERVAL || '1';
    this.watchInterval = parseInt(watchIntervalEnv, 10) * 1000;

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
   * Calculate hash of file content
   *
   * @returns {string|null} Hash of file content, or null if file doesn't exist
   */
  getFileHash() {
    try {
      const content = fs.readFileSync(this.filePath, 'utf8');
      return crypto.createHash('md5').update(content).digest('hex');
    } catch {
      return null;
    }
  }

  /**
   * Watch the JSON file for changes and reload automatically
   *
   * This enables hot-reload: changes to models.json are automatically detected
   * and loaded without restarting the application.
   *
   * Watch Flow:
   * 1. Calculate initial file hash
   * 2. Poll file at configured interval (default: 1s)
   * 3. Calculate new hash and compare with previous
   * 4. If different: load() → validateModels() → callback fires
   * 5. Update hash and continue polling
   *
   * Why Simple Hash-Based Polling?
   * - fs.watch() is unreliable in Docker/CI environments
   * - fs.watchFile() has internal Node.js complexity
   * - Simple hash comparison is deterministic and works everywhere
   * - No timing issues, no file system events needed
   *
   * Error Handling:
   * - Invalid models (bad URL, etc): Logged as warnings, not thrown
   * - File deleted during watch: Hash returns null, no reload
   * - File permission changed: Hash returns null, no reload
   *
   * Platform Notes:
   * - Works reliably in all environments (Docker, CI, network filesystems)
   * - Reload latency: ~watchInterval seconds after file change
   *
   * @param {Function} callback Function to call when models change
   *                            Signature: (models: Object) => void
   *                            Receives new models object
   */
  watch(callback) {
    // Prevent double-watch
    if (this.pollingInterval) {
      console.warn(`Already watching ${this.filePath}`);
      return;
    }

    this.watchCallback = callback;

    // Get initial hash
    this.lastHash = this.getFileHash();
    console.log(
      `Watching ${this.filePath} for changes (polling every ${this.watchInterval / 1000}s)...`,
    );

    // Start polling
    this.pollingInterval = setInterval(async () => {
      const currentHash = this.getFileHash();

      // Check if file content changed
      if (currentHash && currentHash !== this.lastHash) {
        console.log(`${this.filePath} changed, reloading...`);

        try {
          // Load and validate new models
          const models = await this.load();
          console.log(`Models reloaded successfully (${Object.keys(models).length} models)`);

          // Update hash
          this.lastHash = currentHash;

          // Notify config about the change
          if (this.watchCallback) {
            this.watchCallback(models);
          }
        } catch (error) {
          // Log error but don't throw - watcher continues running
          // This allows fixing the file and it will reload on next save
          console.error(`Error reloading models: ${error.message}`);
        }
      }
    }, this.watchInterval);
  }

  /**
   * Stop watching the file for changes
   *
   * Called during application shutdown to cleanup resources.
   *
   * Cleanup Steps:
   * 1. Clear polling interval
   * 2. Nullify all references
   *
   * Safe to call multiple times (idempotent).
   */
  stopWatching() {
    // Stop polling interval if active
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
      this.watchCallback = null;
      this.lastHash = null;
      console.log(`Stopped watching ${this.filePath}`);
    }
  }
}

module.exports = JsonFileModelLoader;
