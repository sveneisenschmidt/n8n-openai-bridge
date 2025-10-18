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

const fs = require("fs");
const path = require("path");

class ModelDiscoveryService {
  constructor(config, n8nClient) {
    this.config = config;
    this.n8nClient = n8nClient;
    this.pollingTimer = null;
    this.errorCount = 0;
    this.currentPollingInterval = config.autoDiscoveryPolling * 1000; // Convert to ms
    this.isRunning = false;
  }

  /**
   * Start the auto-discovery service
   */
  async start() {
    if (!this.config.autoFetchModelsByTag) {
      console.log("[Auto-Discovery] Disabled (AUTO_FETCH_MODELS_BY_TAG=false)");
      return;
    }

    // Validate required configuration
    if (!this.config.n8nApiUrl) {
      throw new Error("Auto-Discovery enabled but N8N_API_URL not configured");
    }

    if (!this.config.n8nApiBearerToken) {
      throw new Error(
        "Auto-Discovery enabled but N8N_API_BEARER_TOKEN not configured",
      );
    }

    console.log("[Auto-Discovery] Starting...");
    console.log(`[Auto-Discovery] Tag: '${this.config.autoDiscoveryTag}'`);
    console.log(
      `[Auto-Discovery] Polling interval: ${this.config.autoDiscoveryPolling}s`,
    );

    // Initial discovery
    await this.discover();

    // Start polling if interval > 0
    if (this.config.autoDiscoveryPolling > 0) {
      this.startPolling();
    }
  }

  /**
   * Start periodic polling
   */
  startPolling() {
    if (this.isRunning) {
      console.log("[Auto-Discovery] Polling already running");
      return;
    }

    this.isRunning = true;
    this.scheduleNextPoll();
  }

  /**
   * Schedule next poll
   */
  scheduleNextPoll() {
    if (!this.isRunning) return;

    this.pollingTimer = setTimeout(async () => {
      await this.discover();
      this.scheduleNextPoll();
    }, this.currentPollingInterval);
  }

  /**
   * Stop the polling service
   */
  stop() {
    if (this.pollingTimer) {
      clearTimeout(this.pollingTimer);
      this.pollingTimer = null;
    }
    this.isRunning = false;
    console.log("[Auto-Discovery] Stopped");
  }

  /**
   * Perform discovery of workflows and update models.json
   * @returns {Promise<object>} - Discovery result with stats
   */
  async discover() {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] Auto-Discovery: Running...`);

    try {
      // Fetch workflows from n8n API
      const workflows = await this.n8nClient.getWorkflows(
        this.config.autoDiscoveryTag,
      );

      console.log(
        `[${timestamp}] Auto-Discovery: Found ${workflows.length} workflows with tag '${this.config.autoDiscoveryTag}'`,
      );

      // Process workflows and build models map
      const result = this.processWorkflows(workflows);

      // Write to models.json
      await this.writeModelsFile(result.models);

      // Reload config models
      this.config.reloadModels();

      // Reset error count on success
      this.errorCount = 0;
      this.currentPollingInterval = this.config.autoDiscoveryPolling * 1000;

      // Log summary
      console.log(
        `[${timestamp}] Auto-Discovery: Complete - ${result.added} added, ${result.skipped} skipped, ${result.warnings.length} warnings`,
      );

      if (result.warnings.length > 0) {
        result.warnings.forEach((warning) =>
          console.log(`[${timestamp}] WARNING: ${warning}`),
        );
      }

      return {
        success: true,
        discovered: workflows.length,
        added: result.added,
        skipped: result.skipped,
        warnings: result.warnings,
      };
    } catch (error) {
      console.error(`[${timestamp}] Auto-Discovery ERROR:`, error.message);

      this.errorCount++;

      // Exponential backoff after 3 consecutive errors
      if (this.errorCount >= 3) {
        this.currentPollingInterval = Math.min(
          this.currentPollingInterval * 2,
          600000, // Max 10 minutes
        );
        console.log(
          `[${timestamp}] Auto-Discovery: Backing off to ${this.currentPollingInterval / 1000}s interval after ${this.errorCount} errors`,
        );
      }

      return {
        success: false,
        error: error.message,
        errorCount: this.errorCount,
      };
    }
  }

  /**
   * Process workflows and extract models
   * @param {Array} workflows - Array of workflow objects
   * @returns {object} - Processed result with models and stats
   */
  processWorkflows(workflows) {
    const models = {};
    const warnings = [];
    let added = 0;
    let skipped = 0;

    for (const workflow of workflows) {
      // Validate workflow
      const validation = this.validateWorkflow(workflow);

      if (!validation.valid) {
        warnings.push(
          `Workflow '${workflow.name}' (ID: ${workflow.id}) skipped: ${validation.reason}`,
        );
        skipped++;
        continue;
      }

      // Check if workflow is inactive
      if (!workflow.active) {
        warnings.push(
          `Workflow '${workflow.name}' (ID: ${workflow.id}) is INACTIVE but added to models`,
        );
      }

      // Extract webhook URL
      const webhookUrl = this.n8nClient.extractWebhookUrl(workflow);

      if (!webhookUrl) {
        warnings.push(
          `Workflow '${workflow.name}' (ID: ${workflow.id}) skipped: No webhook URL could be constructed`,
        );
        skipped++;
        continue;
      }

      // Add to models (using workflow name as model ID)
      models[workflow.name] = webhookUrl;
      added++;
    }

    return {
      models,
      added,
      skipped,
      warnings,
    };
  }

  /**
   * Validate workflow for model discovery
   * @param {object} workflow - Workflow object
   * @returns {object} - Validation result
   */
  validateWorkflow(workflow) {
    // Check if workflow has nodes
    if (
      !workflow.nodes ||
      !Array.isArray(workflow.nodes) ||
      workflow.nodes.length === 0
    ) {
      return {
        valid: false,
        reason: "No nodes found",
      };
    }

    // Check if workflow has webhook node
    const hasWebhook = workflow.nodes.some(
      (node) =>
        node.type === "n8n-nodes-base.webhook" || node.type.includes("webhook"),
    );

    if (!hasWebhook) {
      return {
        valid: false,
        reason: "No webhook trigger found",
      };
    }

    // Check if workflow name is valid
    if (!workflow.name || workflow.name.trim() === "") {
      return {
        valid: false,
        reason: "Invalid workflow name",
      };
    }

    return {
      valid: true,
    };
  }

  /**
   * Write models to models.json file (atomically)
   * @param {object} models - Models object
   */
  async writeModelsFile(models) {
    const modelsPath = path.resolve(this.config.modelsConfigPath);
    const tempPath = `${modelsPath}.tmp`;

    try {
      // Write to temp file first
      const content = JSON.stringify(models, null, 2);
      await fs.promises.writeFile(tempPath, content, "utf8");

      // Atomic rename
      await fs.promises.rename(tempPath, modelsPath);

      console.log(
        `[Auto-Discovery] models.json updated (${Object.keys(models).length} models)`,
      );
    } catch (error) {
      console.error(
        "[Auto-Discovery] Error writing models.json:",
        error.message,
      );

      // Cleanup temp file if it exists
      try {
        await fs.promises.unlink(tempPath);
      } catch {}

      throw error;
    }
  }
}

module.exports = ModelDiscoveryService;
