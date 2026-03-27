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
const FileRepository = require('./repositories/FileRepository');
const ModelLoaderFactory = require('./factories/ModelLoaderFactory');
const WebhookNotifierFactory = require('./factories/WebhookNotifierFactory');
const WebhookNotifierService = require('./services/webhookNotifierService');
const FileService = require('./services/fileService');
const TaskDetectorService = require('./services/taskDetectorService');
const createDetector = require('./detectors/createDetector');
const detectorRegistry = require('./detectors/detectorRegistry');

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

    // Setup file service if enabled
    this.fileRepository = null;
    this.fileService = null;
    if (this.config.filesEnabled) {
      this.fileRepository = new FileRepository();
      this.fileService = new FileService(this.fileRepository, this.config);
    }

    // Setup task detector if enabled
    this.taskDetectorService = null;
    if (this.config.enableTaskDetection) {
      this.taskDetectorService = new TaskDetectorService();
      this.registerBuiltInDetectors();
    }

    // Promise that tracks model loading status
    // Server MUST wait for this promise to resolve before accepting requests
    this.loadingPromise = null;
  }

  /**
   * Register built-in task detectors from config
   * Creates detectors dynamically from detectorConfig for all supported clients
   * @private
   */
  registerBuiltInDetectors() {
    if (!this.taskDetectorService) {
      return;
    }

    // Register detectors for each task type from registry
    for (const [taskType, patternGroups] of Object.entries(detectorRegistry)) {
      // Only register if there are pattern groups defined
      if (patternGroups.length > 0) {
        const detector = createDetector(patternGroups);
        this.taskDetectorService.registerDetector(taskType, detector);
      }
    }
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
          const payload = WebhookNotifierService.createPayload(
            models,
            this.modelLoader.constructor.name,
            WebhookNotifierService.EventType.MODELS_LOADED,
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

    // Start file cleanup interval if enabled
    if (this.fileService) {
      this.fileService.startCleanupInterval();
    }
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
      const payload = WebhookNotifierService.createPayload(
        newModels,
        this.modelLoader.constructor.name,
        WebhookNotifierService.EventType.MODELS_CHANGED,
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
    if (this.fileService) {
      this.fileService.stopCleanupInterval();
    }
    if (this.fileRepository) {
      this.fileRepository.clear();
    }
  }
}

module.exports = Bootstrap;
