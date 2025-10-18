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
 * Loads models from a JSON file (e.g., models.json)
 */
class JsonFileModelLoader extends ModelLoader {
  /**
   * @param {string} filePath Path to the JSON file containing models
   */
  constructor(filePath) {
    super();
    this.filePath = path.resolve(filePath);
    this.watcher = null;
    this.watchCallback = null;
    this.reloadTimeout = null;
  }

  /**
   * Load models from the JSON file synchronously
   * @returns {Object} Object with model_id -> webhook_url mapping
   */
  loadSync() {
    try {
      const data = fs.readFileSync(this.filePath, 'utf8');
      const models = JSON.parse(data);
      this.validateModels(models);
      return models;
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error(`Models file not found: ${this.filePath}`);
      } else if (error instanceof SyntaxError) {
        throw new Error(`Invalid JSON in models file: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Load models from the JSON file
   * @returns {Promise<Object>} Object with model_id -> webhook_url mapping
   */
  async load() {
    return this.loadSync();
  }

  /**
   * Watch the JSON file for changes and reload automatically
   * @param {Function} callback Function to call when models change (receives new models object)
   */
  watch(callback) {
    if (this.watcher) {
      console.warn(`[${new Date().toISOString()}] Already watching ${this.filePath}`);
      return;
    }

    this.watchCallback = callback;

    try {
      this.watcher = fs.watch(this.filePath, (eventType) => {
        if (eventType === 'change') {
          // Debounce: wait 100ms before reloading to avoid multiple reloads
          clearTimeout(this.reloadTimeout);
          this.reloadTimeout = setTimeout(async () => {
            console.log(`[${new Date().toISOString()}] ${this.filePath} changed, reloading...`);
            try {
              const models = await this.load();
              console.log(
                `[${new Date().toISOString()}] Models reloaded successfully (${Object.keys(models).length} models)`
              );
              if (this.watchCallback) {
                this.watchCallback(models);
              }
            } catch (error) {
              console.error(
                `[${new Date().toISOString()}] Error reloading models: ${error.message}`
              );
            }
          }, 100);
        }
      });
      console.log(`[${new Date().toISOString()}] Watching ${this.filePath} for changes...`);
    } catch (error) {
      console.warn(
        `[${new Date().toISOString()}] Could not watch ${this.filePath}: ${error.message}`
      );
    }
  }

  /**
   * Stop watching the file for changes
   */
  stopWatching() {
    if (this.reloadTimeout) {
      clearTimeout(this.reloadTimeout);
      this.reloadTimeout = null;
    }

    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
      this.watchCallback = null;
      console.log(`[${new Date().toISOString()}] Stopped watching ${this.filePath}`);
    }
  }
}

module.exports = JsonFileModelLoader;
