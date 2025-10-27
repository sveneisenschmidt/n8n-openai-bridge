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

const Config = require('./config/Config');
const ModelRepository = require('./repositories/ModelRepository');
const ModelLoaderFactory = require('./factories/ModelLoaderFactory');
const WebhookNotifierFactory = require('./factories/WebhookNotifierFactory');
const WebhookNotifier = require('./services/webhookNotifier');

/**
 * Bootstrap - Application Lifecycle Orchestrator
 *
 * Responsibilities:
 * - Orchestrate application startup
 * - Wire dependencies together
 * - Setup model watching
 * - Handle shutdown
 * - Coordinate loader + notifier interactions
 *
 * Does NOT:
 * - Parse configuration (see Config)
 * - Create loaders (see ModelLoaderFactory)
 * - Manage model state (see ModelRepository)
 */
class Bootstrap {
  constructor() {
    // Create core components
    this.config = new Config();
    this.modelRepository = new ModelRepository();
    this.modelLoader = ModelLoaderFactory.createModelLoader();
    this.webhookNotifier = WebhookNotifierFactory.createWebhookNotifier();

    // Promise that tracks model loading status
    // Server MUST wait for this promise to resolve before accepting requests
    this.loadingPromise = null;
  }

  /**
   * Initialize the application
   * Loads models asynchronously and sets up watchers
   * @returns {Promise<void>}
   */
  async initialize() {
    this.loadingPromise = this.modelLoader
      .load()
      .then((models) => {
        this.modelRepository.updateModels(models);

        // Notify webhook on startup if enabled
        if (this.webhookNotifier.enabled && this.webhookNotifier.notifyOnStartup) {
          const payload = WebhookNotifier.createPayload(
            models,
            this.modelLoader.constructor.name,
            WebhookNotifier.EventType.MODELS_LOADED,
          );
          this.webhookNotifier.notify(payload).catch(() => {
            console.warn(
              `[${new Date().toISOString()}] Webhook notification on startup failed, but models loaded successfully`,
            );
          });
        }

        return models;
      })
      .catch((error) => {
        console.error('Failed to load models:', error.message);
        throw error; // Propagate error to server startup
      });

    // Wait for models to load
    await this.loadingPromise;

    // Setup model watcher after initial load
    this.setupModelWatcher();
  }

  /**
   * Setup model watcher for hot-reload
   * Watches for model changes and updates repository
   * @private
   */
  setupModelWatcher() {
    this.modelLoader.watch((newModels) => {
      console.log('Models changed, reloading...');
      this.modelRepository.updateModels(newModels);
      console.log(`Models reloaded successfully (${this.modelRepository.getModelCount()} models)`);

      // Notify webhook subscribers about model changes
      const payload = WebhookNotifier.createPayload(
        newModels,
        this.modelLoader.constructor.name,
        WebhookNotifier.EventType.MODELS_CHANGED,
      );
      this.webhookNotifier.notify(payload).catch(() => {
        console.warn(
          `[${new Date().toISOString()}] Webhook notification on model change failed, but models reloaded successfully`,
        );
      });
    });
  }

  /**
   * Cleanup resources on shutdown
   * Stops model loader watching
   */
  close() {
    if (this.modelLoader) {
      this.modelLoader.stopWatching();
    }
  }
}

module.exports = Bootstrap;
