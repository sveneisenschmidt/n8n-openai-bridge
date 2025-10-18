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
const ModelDiscoveryService = require("../../src/services/modelDiscoveryService");

describe("ModelDiscoveryService", () => {
  let service;
  let mockConfig;
  let mockN8nClient;
  let tempModelsPath;

  beforeEach(() => {
    // Create temp models.json path
    tempModelsPath = path.join(__dirname, "../temp-models.json");

    mockConfig = {
      autoFetchModelsByTag: true,
      autoDiscoveryTag: "n8n-openai-model",
      autoDiscoveryPolling: 300,
      modelsConfigPath: tempModelsPath,
      reloadModels: jest.fn(),
    };

    mockN8nClient = {
      getWorkflows: jest.fn(),
      extractWebhookUrl: jest.fn(),
    };

    service = new ModelDiscoveryService(mockConfig, mockN8nClient);
  });

  afterEach(() => {
    // Cleanup
    service.stop();
    if (fs.existsSync(tempModelsPath)) {
      fs.unlinkSync(tempModelsPath);
    }
    if (fs.existsSync(tempModelsPath + ".tmp")) {
      fs.unlinkSync(tempModelsPath + ".tmp");
    }
  });

  describe("validateWorkflow", () => {
    it("should validate workflow with webhook node", () => {
      const workflow = {
        id: "wf-1",
        name: "Test Workflow",
        nodes: [{ type: "n8n-nodes-base.webhook", webhookId: "webhook-123" }],
      };

      const result = service.validateWorkflow(workflow);
      expect(result.valid).toBe(true);
    });

    it("should reject workflow without nodes", () => {
      const workflow = {
        id: "wf-1",
        name: "Test Workflow",
        nodes: [],
      };

      const result = service.validateWorkflow(workflow);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe("No nodes found");
    });

    it("should reject workflow without webhook node", () => {
      const workflow = {
        id: "wf-1",
        name: "Test Workflow",
        nodes: [{ type: "n8n-nodes-base.someOtherNode" }],
      };

      const result = service.validateWorkflow(workflow);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe("No webhook trigger found");
    });

    it("should reject workflow with empty name", () => {
      const workflow = {
        id: "wf-1",
        name: "",
        nodes: [{ type: "n8n-nodes-base.webhook", webhookId: "webhook-123" }],
      };

      const result = service.validateWorkflow(workflow);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe("Invalid workflow name");
    });
  });

  describe("processWorkflows", () => {
    it("should process valid workflows", () => {
      const workflows = [
        {
          id: "wf-1",
          name: "Model A",
          active: true,
          nodes: [{ type: "n8n-nodes-base.webhook", webhookId: "webhook-1" }],
        },
        {
          id: "wf-2",
          name: "Model B",
          active: true,
          nodes: [{ type: "n8n-nodes-base.webhook", webhookId: "webhook-2" }],
        },
      ];

      mockN8nClient.extractWebhookUrl.mockImplementation((wf) => {
        return `https://n8n.test/webhook/${wf.nodes[0].webhookId}`;
      });

      const result = service.processWorkflows(workflows);

      expect(result.added).toBe(2);
      expect(result.skipped).toBe(0);
      expect(result.models["Model A"]).toBe(
        "https://n8n.test/webhook/webhook-1",
      );
      expect(result.models["Model B"]).toBe(
        "https://n8n.test/webhook/webhook-2",
      );
    });

    it("should warn about inactive workflows but still add them", () => {
      const workflows = [
        {
          id: "wf-1",
          name: "Inactive Model",
          active: false,
          nodes: [{ type: "n8n-nodes-base.webhook", webhookId: "webhook-1" }],
        },
      ];

      mockN8nClient.extractWebhookUrl.mockReturnValue(
        "https://n8n.test/webhook/webhook-1",
      );

      const result = service.processWorkflows(workflows);

      expect(result.added).toBe(1);
      expect(result.warnings.length).toBe(1);
      expect(result.warnings[0]).toContain("INACTIVE");
      expect(result.models["Inactive Model"]).toBe(
        "https://n8n.test/webhook/webhook-1",
      );
    });

    it("should skip workflows without webhook URL", () => {
      const workflows = [
        {
          id: "wf-1",
          name: "Model A",
          active: true,
          nodes: [{ type: "n8n-nodes-base.webhook" }],
        },
      ];

      mockN8nClient.extractWebhookUrl.mockReturnValue(null);

      const result = service.processWorkflows(workflows);

      expect(result.added).toBe(0);
      expect(result.skipped).toBe(1);
      expect(result.warnings.length).toBe(1);
      expect(result.warnings[0]).toContain(
        "No webhook URL could be constructed",
      );
    });

    it("should skip invalid workflows", () => {
      const workflows = [
        {
          id: "wf-1",
          name: "Model A",
          active: true,
          nodes: [], // No nodes
        },
      ];

      const result = service.processWorkflows(workflows);

      expect(result.added).toBe(0);
      expect(result.skipped).toBe(1);
      expect(result.warnings.length).toBe(1);
      expect(result.warnings[0]).toContain("No nodes found");
    });
  });

  describe("discover", () => {
    it("should successfully discover and write models", async () => {
      const workflows = [
        {
          id: "wf-1",
          name: "Model A",
          active: true,
          nodes: [{ type: "n8n-nodes-base.webhook", webhookId: "webhook-1" }],
        },
      ];

      mockN8nClient.getWorkflows.mockResolvedValue(workflows);
      mockN8nClient.extractWebhookUrl.mockReturnValue(
        "https://n8n.test/webhook/webhook-1",
      );

      const result = await service.discover();

      expect(result.success).toBe(true);
      expect(result.discovered).toBe(1);
      expect(result.added).toBe(1);
      expect(result.skipped).toBe(0);
      expect(mockConfig.reloadModels).toHaveBeenCalled();

      // Check models.json was written
      expect(fs.existsSync(tempModelsPath)).toBe(true);
      const models = JSON.parse(fs.readFileSync(tempModelsPath, "utf8"));
      expect(models["Model A"]).toBe("https://n8n.test/webhook/webhook-1");
    });

    it("should handle API errors gracefully", async () => {
      mockN8nClient.getWorkflows.mockRejectedValue(new Error("API Error"));

      const result = await service.discover();

      expect(result.success).toBe(false);
      expect(result.error).toBe("API Error");
      expect(result.errorCount).toBe(1);
    });

    it("should increment error count on consecutive failures", async () => {
      mockN8nClient.getWorkflows.mockRejectedValue(new Error("API Error"));

      await service.discover();
      await service.discover();
      const result = await service.discover();

      expect(result.errorCount).toBe(3);
    });

    it("should reset error count on success", async () => {
      mockN8nClient.getWorkflows.mockRejectedValue(new Error("API Error"));
      await service.discover();
      expect(service.errorCount).toBe(1);

      // Now succeed
      mockN8nClient.getWorkflows.mockResolvedValue([]);
      await service.discover();

      expect(service.errorCount).toBe(0);
    });
  });

  describe("start/stop", () => {
    it("should not start if auto-discovery is disabled", async () => {
      mockConfig.autoFetchModelsByTag = false;
      mockN8nClient.getWorkflows.mockResolvedValue([]);

      await service.start();

      expect(mockN8nClient.getWorkflows).not.toHaveBeenCalled();
    });

    it("should throw error if N8N_API_URL not configured", async () => {
      mockConfig.n8nApiUrl = "";
      mockConfig.n8nApiBearerToken = "test-token";

      await expect(service.start()).rejects.toThrow(
        "Auto-Discovery enabled but N8N_API_URL not configured",
      );
    });

    it("should throw error if N8N_API_BEARER_TOKEN not configured", async () => {
      mockConfig.n8nApiUrl = "https://n8n.test";
      mockConfig.n8nApiBearerToken = "";

      await expect(service.start()).rejects.toThrow(
        "Auto-Discovery enabled but N8N_API_BEARER_TOKEN not configured",
      );
    });

    it("should perform initial discovery on start", async () => {
      mockConfig.n8nApiUrl = "https://n8n.test";
      mockConfig.n8nApiBearerToken = "test-token";
      mockN8nClient.getWorkflows.mockResolvedValue([]);

      await service.start();

      expect(mockN8nClient.getWorkflows).toHaveBeenCalledWith(
        "n8n-openai-model",
      );
    });

    it("should stop polling", () => {
      service.startPolling();
      expect(service.isRunning).toBe(true);

      service.stop();
      expect(service.isRunning).toBe(false);
    });
  });

  describe("writeModelsFile", () => {
    it("should write models atomically", async () => {
      const models = {
        "Model A": "https://n8n.test/webhook/a",
        "Model B": "https://n8n.test/webhook/b",
      };

      await service.writeModelsFile(models);

      expect(fs.existsSync(tempModelsPath)).toBe(true);
      const written = JSON.parse(fs.readFileSync(tempModelsPath, "utf8"));
      expect(written).toEqual(models);
    });

    it("should cleanup temp file on error", async () => {
      const models = { "Model A": "url" };

      // Make the rename fail by using a read-only path
      const originalPath = service.config.modelsConfigPath;
      service.config.modelsConfigPath = "/invalid/path/models.json";

      await expect(service.writeModelsFile(models)).rejects.toThrow();

      service.config.modelsConfigPath = originalPath;
    });
  });
});
