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

const ModelLoader = require('./ModelLoader');
const McpClient = require('../mcpClient');

/**
 * Loads models from n8n's Instance-Level MCP Server
 *
 * This loader uses n8n's native MCP (Model Context Protocol) server to discover
 * workflows that are enabled for MCP access. Unlike N8nApiModelLoader which uses
 * the REST API, this loader communicates via the MCP protocol.
 *
 * Key Differences from N8nApiModelLoader:
 * - Uses MCP protocol instead of REST API
 * - Discovers workflows enabled via Settings → "Available in MCP"
 * - Returns extended model format with workflowId for MCP execution
 * - Uses MCP_POLL_INTERVAL for polling (not AUTO_DISCOVERY_POLL_INTERVAL)
 *
 * Model Format:
 * Unlike other loaders that return string URLs, this loader returns objects:
 * {
 *   "model-name": { type: "mcp", workflowId: "abc123" }
 * }
 *
 * Architecture:
 * 1. Connect to n8n MCP server via Streamable HTTP
 * 2. Call search_workflows to discover MCP-enabled workflows
 * 3. Map workflows to extended model format
 * 4. Optional: Poll for changes at configured interval
 *
 * Requirements:
 * - n8n instance with MCP server enabled
 * - MCP bearer token (N8N_MCP_BEARER_TOKEN)
 * - MCP endpoint URL (N8N_MCP_ENDPOINT)
 * - Workflows must be marked "Available in MCP"
 */
class McpModelLoader extends ModelLoader {
  /**
   * Loader type identifier for MODEL_LOADER_TYPE env var
   */
  static TYPE = 'mcp';

  /**
   * Get required environment variables for this loader
   *
   * Note: N8N_MCP_ENDPOINT and N8N_MCP_BEARER_TOKEN are instance-level
   * variables validated by Config, not loader-level. This loader only
   * defines MCP_POLL_INTERVAL as its own configuration.
   *
   * @returns {Array<{name: string, description: string, required: boolean, defaultValue?: string}>}
   */
  static getRequiredEnvVars() {
    return [
      {
        name: 'N8N_MCP_ENDPOINT',
        description: 'MCP server endpoint URL (e.g., http://n8n:5678/mcp-server/http)',
        required: true,
      },
      {
        name: 'N8N_MCP_BEARER_TOKEN',
        description: 'Bearer token for MCP authentication',
        required: true,
      },
      {
        name: 'MCP_POLL_INTERVAL',
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
    const endpoint = envValues.N8N_MCP_ENDPOINT;
    const bearerToken = envValues.N8N_MCP_BEARER_TOKEN;
    const pollingIntervalStr = envValues.MCP_POLL_INTERVAL;

    this.endpoint = endpoint;
    this.bearerToken = bearerToken;

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
      `McpModelLoader: Using MCP server at ${this.endpoint} (poll: ${this.pollingInterval}s)`,
    );

    // Create MCP client for discovery
    this.mcpClient = new McpClient(this.endpoint, this.bearerToken);

    // Polling state
    this.pollingTimer = null;
    this.watchCallback = null;
  }

  /**
   * Load models from n8n MCP server
   *
   * Implementation Flow:
   * 1. Call search_workflows via MCP
   * 2. Filter active workflows with chat triggers
   * 3. Convert to extended model format
   * 4. Return models object
   *
   * @returns {Promise<Object>} Object with model_id -> { type: "mcp", workflowId } mapping
   * @throws {Error} If MCP request fails
   */
  async load() {
    try {
      // Search for MCP-enabled workflows
      const workflows = await this.mcpClient.searchWorkflows();

      console.log(`Fetched ${workflows.length} MCP-enabled workflows`);

      // Convert workflows to models
      const models = this.workflowsToModels(workflows);

      console.log(`Loaded ${Object.keys(models).length} models from MCP`);

      return models;
    } catch (error) {
      // Enhance error message with context
      throw new Error(`MCP model discovery failed: ${error.message}`);
    }
  }

  /**
   * Convert array of workflows to models object
   *
   * Model Format:
   * {
   *   "workflow-name": { type: "mcp", workflowId: "abc123" }
   * }
   *
   * @param {Array} workflows Array of workflow objects from MCP
   * @returns {Object} Models object with extended format
   * @private
   */
  workflowsToModels(workflows) {
    const models = {};
    const seenIds = new Set();

    for (const workflow of workflows) {
      // Skip inactive workflows
      if (!workflow.active) {
        console.warn(`Skipping inactive workflow: "${workflow.name}" (${workflow.id})`);
        continue;
      }

      // Generate model ID from workflow name
      const modelId = this.generateModelId(workflow);

      // Check for duplicate model IDs
      if (seenIds.has(modelId)) {
        console.warn(
          `Duplicate model ID "${modelId}" detected for workflow "${workflow.name}" (${workflow.id}), skipping`,
        );
        continue;
      }

      seenIds.add(modelId);

      // Store in extended format for MCP execution
      models[modelId] = {
        type: 'mcp',
        workflowId: workflow.id,
      };
    }

    return models;
  }

  /**
   * Generate model ID from workflow
   *
   * Strategy:
   * 1. Use original workflow name (unsanitized)
   * 2. Fallback to workflow ID if name is empty
   *
   * @param {Object} workflow Workflow object from MCP
   * @returns {string} Model ID
   * @private
   */
  generateModelId(workflow) {
    if (workflow.name && workflow.name.trim()) {
      return workflow.name.trim();
    }
    return workflow.id;
  }

  /**
   * Validate models - override to handle extended format
   *
   * For MCP models, we validate:
   * - Model ID is non-empty string
   * - Model value is object with type: "mcp" and workflowId
   *
   * @param {Object} models Raw models object
   * @returns {Object} Validated models (invalid entries filtered)
   */
  validateModels(models) {
    const validated = {};

    for (const [modelId, value] of Object.entries(models)) {
      // Validate model ID
      if (!modelId || typeof modelId !== 'string') {
        console.warn(`Invalid model ID: ${modelId}`);
        continue;
      }

      // Validate MCP model format
      if (!value || typeof value !== 'object') {
        console.warn(`Invalid model value for "${modelId}": Expected object`);
        continue;
      }

      if (value.type !== 'mcp') {
        console.warn(`Invalid model type for "${modelId}": Expected "mcp"`);
        continue;
      }

      if (!value.workflowId || typeof value.workflowId !== 'string') {
        console.warn(`Invalid workflowId for "${modelId}"`);
        continue;
      }

      validated[modelId] = value;
    }

    return validated;
  }

  /**
   * Watch for changes by polling MCP server at configured interval
   *
   * @param {Function} callback Function to call when models change
   */
  watch(callback) {
    if (this.pollingInterval === 0) {
      console.log('Polling disabled (MCP_POLL_INTERVAL=0)');
      return;
    }

    if (this.pollingTimer) {
      console.warn('Polling already active');
      return;
    }

    this.watchCallback = callback;

    console.log(`Starting MCP polling every ${this.pollingInterval}s`);

    // Start polling timer
    this.pollingTimer = setInterval(async () => {
      console.log('Polling MCP for model changes...');
      try {
        const models = await this.load();

        // Calculate hash of current models
        const currentHash = this.getModelsHash(models);

        // Check if models changed
        if (currentHash !== this.lastHash) {
          this.lastHash = currentHash;

          if (this.watchCallback) {
            this.watchCallback(models);
          }
        }
      } catch (error) {
        console.error(`MCP polling error: ${error.message}`);
      }
    }, this.pollingInterval * 1000);
  }

  /**
   * Stop polling for changes
   */
  stopWatching() {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
      this.watchCallback = null;
      this.lastHash = null;
      console.log('Stopped polling MCP server');
    }
  }
}

module.exports = McpModelLoader;
