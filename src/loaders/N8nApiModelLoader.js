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
 * Loads models from n8n workflows via n8n REST API
 *
 * This loader enables automatic discovery of OpenAI models by querying
 * n8n workflows that are tagged with a specific tag (default: "n8n-openai-bridge").
 * It eliminates the need for manual models.json maintenance.
 *
 * Features:
 * - Auto-discovery of workflows via n8n API
 * - Tag-based filtering
 * - Webhook URL extraction from workflow nodes
 * - Polling mechanism for auto-reload
 * - Model ID generation from workflow names/tags
 *
 * Architecture:
 * 1. Fetch workflows from n8n API (GET /api/v1/workflows)
 * 2. Filter by configured tag
 * 3. Extract webhook URLs from workflow nodes
 * 4. Generate model IDs (priority: custom tag > name > workflow ID)
 * 5. Validate models using base class
 * 6. Optional: Poll for changes at configured interval
 *
 * Requirements:
 * - n8n API key (X-N8N-API-KEY header)
 * - n8n base URL
 * - Workflows must be active
 * - Workflows must have webhook nodes
 * - Workflows must be tagged with configured tag
 *
 * Security Considerations:
 * - API key has read/write access to n8n (handle securely!)
 * - Only production webhook URLs are used (not test URLs)
 * - HTTPS recommended for API communication
 *
 * Error Handling:
 * - Startup errors: Propagated to caller (server won't start)
 * - Polling errors: Logged but don't stop polling
 * - Invalid workflows: Filtered out with warnings (graceful degradation)
 */
class N8nApiModelLoader extends ModelLoader {
  /**
   * Loader type identifier for MODEL_LOADER_TYPE env var
   */
  static TYPE = 'n8n-api';

  /**
   * Get required environment variables for this loader
   *
   * @returns {Array<{name: string, description: string, required: boolean, defaultValue?: string}>}
   */
  static getRequiredEnvVars() {
    return [
      {
        name: 'N8N_BASE_URL',
        description: 'Base URL of n8n instance',
        required: true,
      },
      {
        name: 'N8N_API_BEARER_TOKEN',
        description: 'n8n API key for REST API access',
        required: true,
      },
      {
        name: 'AUTO_DISCOVERY_TAG',
        description: 'Tag to filter workflows',
        required: false,
        defaultValue: 'n8n-openai-bridge',
      },
      {
        name: 'AUTO_DISCOVERY_POLLING',
        description: 'Polling interval in seconds (60-600, 0=disabled)',
        required: false,
        defaultValue: '300',
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
    const n8nBaseUrl = envValues.N8N_BASE_URL;
    const apiToken = envValues.N8N_API_BEARER_TOKEN;
    const tag = envValues.AUTO_DISCOVERY_TAG;
    const pollingIntervalStr = envValues.AUTO_DISCOVERY_POLLING;

    // Remove trailing slash from base URL for consistency
    this.n8nBaseUrl = n8nBaseUrl.replace(/\/$/, '');
    this.apiToken = apiToken;
    this.tag = tag;

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
      `N8nApiModelLoader: Polling every ${this.pollingInterval}s for workflows tagged "${this.tag}"`,
    );

    // Polling state
    this.pollingTimer = null;
    this.watchCallback = null;

    // Configure axios instance for n8n API
    this.axiosInstance = axios.create({
      baseURL: this.n8nBaseUrl,
      headers: {
        'X-N8N-API-KEY': this.apiToken,
      },
      timeout: 10000, // 10 second timeout
    });
  }

  /**
   * Load models from n8n API
   *
   * Implementation Flow:
   * 1. Fetch workflows from n8n API
   * 2. Convert workflows to models object
   * 3. Validate models using base class
   * 4. Return validated models
   *
   * @returns {Promise<Object>} Object with model_id -> webhook_url mapping
   * @throws {Error} If API request fails or no valid models found
   */
  async load() {
    try {
      // Fetch workflows from n8n API
      const workflows = await this.fetchWorkflows();

      console.log(
        `Fetched ${workflows.length} workflows from n8n (tag: "${this.tag}", active: true)`,
      );

      // Convert workflows to models object
      const models = this.workflowsToModels(workflows);

      // Validate models using base class (graceful degradation)
      const validatedModels = this.validateModels(models);

      console.log(`Loaded ${Object.keys(validatedModels).length} models from n8n`);

      return validatedModels;
    } catch (error) {
      // Enhance error message with context
      if (error.response) {
        // HTTP error from n8n API
        const status = error.response.status;
        const message = error.response.data?.message || error.message;

        if (status === 401) {
          throw new Error('n8n API authentication failed: Invalid API token');
        } else if (status === 403) {
          throw new Error('n8n API access forbidden: Token lacks required permissions');
        } else if (status === 404) {
          throw new Error(`n8n API not found: Check N8N_BASE_URL (${this.n8nBaseUrl})`);
        } else {
          throw new Error(`n8n API error (${status}): ${message}`);
        }
      } else if (error.request) {
        // Network error (no response received)
        throw new Error(`Cannot reach n8n API at ${this.n8nBaseUrl}: ${error.message}`);
      } else {
        // Other errors (validation, etc)
        throw error;
      }
    }
  }

  /**
   * Fetch workflows from n8n REST API
   *
   * API Endpoint: GET /api/v1/workflows
   * Query Parameters:
   * - active=true: Only active workflows
   * - tags=<tag>: Filter by tag
   *
   * @returns {Promise<Array>} Array of workflow objects
   * @throws {Error} If API request fails
   * @private
   */
  async fetchWorkflows() {
    const response = await this.axiosInstance.get('/api/v1/workflows', {
      params: {
        active: true, // Only active workflows
        tags: this.tag, // Filter by configured tag
      },
    });

    // n8n API returns { data: [...workflows...] }
    return response.data.data || [];
  }

  /**
   * Convert array of n8n workflows to models object
   *
   * Process:
   * 1. Extract webhook URL from each workflow
   * 2. Generate model ID (priority: custom tag > name > workflow ID)
   * 3. Build models object { modelId: webhookUrl }
   * 4. Handle duplicates and invalid workflows
   *
   * @param {Array} workflows Array of workflow objects from n8n API
   * @returns {Object} Models object { model_id: webhook_url }
   * @private
   */
  workflowsToModels(workflows) {
    const models = {};
    const seenIds = new Set();

    for (const workflow of workflows) {
      // Skip inactive workflows (should already be filtered by API, but double-check)
      if (!workflow.active) {
        console.warn(`Skipping inactive workflow: "${workflow.name}" (${workflow.id})`);
        continue;
      }

      // Extract webhook URL
      const webhookUrl = this.extractWebhookUrl(workflow);
      if (!webhookUrl) {
        console.warn(
          `Skipping workflow "${workflow.name}" (${workflow.id}): No webhook node found or webhook path missing`,
        );
        continue;
      }

      // Generate model ID
      const modelId = this.generateModelId(workflow);

      // Check for duplicate model IDs
      if (seenIds.has(modelId)) {
        console.warn(
          `Duplicate model ID "${modelId}" detected for workflow "${workflow.name}" (${workflow.id}), skipping`,
        );
        continue;
      }

      seenIds.add(modelId);
      models[modelId] = webhookUrl;
    }

    return models;
  }

  /**
   * Generate model ID from workflow
   *
   * Priority order:
   * 1. Custom tag: "model:custom-id" → "custom-id"
   * 2. Workflow name: "GPT-4 Agent" → "gpt-4-agent"
   * 3. Workflow ID: fallback if name is invalid
   *
   * Sanitization:
   * - Lowercase
   * - Spaces → Hyphens
   * - Remove non-alphanumeric (except hyphens and underscores)
   *
   * @param {Object} workflow Workflow object from n8n API
   * @returns {string} Model ID
   * @private
   */
  generateModelId(workflow) {
    // Priority 1: Custom "model:" tag
    const modelTag = (workflow.tags || []).find((t) => t.name && t.name.startsWith('model:'));
    if (modelTag) {
      const customId = modelTag.name.substring(6).trim(); // Remove "model:" prefix
      if (customId) {
        return customId;
      }
    }

    // Priority 2: Sanitized workflow name
    if (workflow.name) {
      const sanitized = workflow.name
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-') // Spaces to hyphens
        .replace(/[^a-z0-9-_]/g, ''); // Remove invalid chars

      if (sanitized) {
        return sanitized;
      }
    }

    // Priority 3: Workflow ID (fallback)
    return workflow.id;
  }

  /**
   * Extract webhook URL from workflow nodes
   *
   * Logic:
   * 1. Find first webhook node (type: "n8n-nodes-base.webhook")
   * 2. Extract webhook path from node parameters
   * 3. Construct production webhook URL
   * 4. Only return URL if workflow is active
   *
   * Note: Only production webhook URLs are used.
   * Test URLs are not supported (unreliable, not meant for production).
   *
   * @param {Object} workflow Workflow object from n8n API
   * @returns {string|null} Webhook URL or null if not found
   * @private
   */
  extractWebhookUrl(workflow) {
    // Find first webhook node
    const webhookNode = (workflow.nodes || []).find(
      (node) => node.type === 'n8n-nodes-base.webhook',
    );

    if (!webhookNode) {
      return null;
    }

    // Extract webhook path from node parameters
    const path = webhookNode.parameters?.path;
    if (!path || typeof path !== 'string') {
      return null;
    }

    // Only return URL if workflow is active (production URL)
    if (!workflow.active) {
      return null;
    }

    // Construct production webhook URL
    // Format: https://n8n.example.com/webhook/<path>
    return `${this.n8nBaseUrl}/webhook/${path}`;
  }

  /**
   * Watch for changes by polling n8n API at configured interval
   *
   * Polling Flow:
   * 1. Start timer with configured interval
   * 2. On timer: fetch workflows → convert to models → validate → callback
   * 3. On error: log but continue polling (don't give up on temporary failures)
   * 4. Repeat until stopWatching() is called
   *
   * Why polling instead of webhooks?
   * - Simpler setup (no need for n8n to know about bridge)
   * - More reliable (no network issues between n8n and bridge)
   * - Works with any n8n instance (no special configuration needed)
   *
   * Polling is disabled when pollingInterval = 0
   *
   * @param {Function} callback Function to call when models change
   *                            Signature: (models: Object) => void
   */
  watch(callback) {
    if (this.pollingInterval === 0) {
      console.log('Polling disabled (AUTO_DISCOVERY_POLLING=0)');
      return;
    }

    if (this.pollingTimer) {
      console.warn('Polling already active');
      return;
    }

    this.watchCallback = callback;

    console.log(`Starting polling every ${this.pollingInterval}s for tag "${this.tag}"`);

    // Start polling timer
    this.pollingTimer = setInterval(async () => {
      try {
        console.log('Polling n8n for workflow changes...');
        const models = await this.load();

        // Notify callback about new models
        if (this.watchCallback) {
          this.watchCallback(models);
        }
      } catch (error) {
        // Log error but don't stop polling
        // This allows recovery from temporary failures (network issues, n8n restart, etc)
        console.error(`Polling error: ${error.message}`);
      }
    }, this.pollingInterval * 1000); // Convert seconds to milliseconds
  }

  /**
   * Stop polling for changes
   *
   * Called during application shutdown to cleanup resources.
   * Clears polling timer and callback reference.
   *
   * Safe to call multiple times (idempotent).
   */
  stopWatching() {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
      this.watchCallback = null;
      console.log('Stopped polling n8n API');
    }
  }
}

module.exports = N8nApiModelLoader;
