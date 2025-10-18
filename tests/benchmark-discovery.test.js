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

/**
 * Benchmark tests for Auto-Discovery performance
 *
 * Run with: npm test -- tests/benchmark-discovery.test.js
 */

const fs = require('fs');
const path = require('path');
const ModelDiscoveryService = require('../src/services/modelDiscoveryService');

// Suppress console output during benchmarks
global.console = {
  ...console,
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

describe('Auto-Discovery Performance Benchmarks', () => {
  let service;
  let mockConfig;
  let mockN8nClient;
  let tempModelsPath;

  beforeEach(() => {
    tempModelsPath = path.join(__dirname, 'temp-benchmark-models.json');

    mockConfig = {
      autoFetchModelsByTag: true,
      autoDiscoveryTag: 'n8n-openai-model',
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
    service.stop();
    if (fs.existsSync(tempModelsPath)) {
      fs.unlinkSync(tempModelsPath);
    }
  });

  describe('processWorkflows performance', () => {
    it('should process 10 workflows in under 50ms', () => {
      const workflows = generateMockWorkflows(10);
      mockN8nClient.extractWebhookUrl.mockImplementation((wf) =>
        `https://n8n.test/webhook/${wf.id}`
      );

      const start = Date.now();
      const result = service.processWorkflows(workflows);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(50);
      expect(result.added).toBe(10);
    });

    it('should process 100 workflows in under 200ms', () => {
      const workflows = generateMockWorkflows(100);
      mockN8nClient.extractWebhookUrl.mockImplementation((wf) =>
        `https://n8n.test/webhook/${wf.id}`
      );

      const start = Date.now();
      const result = service.processWorkflows(workflows);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(200);
      expect(result.added).toBe(100);
    });

    it('should process 500 workflows in under 1000ms', () => {
      const workflows = generateMockWorkflows(500);
      mockN8nClient.extractWebhookUrl.mockImplementation((wf) =>
        `https://n8n.test/webhook/${wf.id}`
      );

      const start = Date.now();
      const result = service.processWorkflows(workflows);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(1000);
      expect(result.added).toBe(500);
    });

    it('should handle mixed valid/invalid workflows efficiently', () => {
      const workflows = [
        ...generateMockWorkflows(50, true),  // valid
        ...generateMockWorkflows(50, false), // invalid (no webhook)
      ];

      mockN8nClient.extractWebhookUrl.mockImplementation((wf) =>
        wf.nodes.some(n => n.type === 'n8n-nodes-base.webhook')
          ? `https://n8n.test/webhook/${wf.id}`
          : null
      );

      const start = Date.now();
      const result = service.processWorkflows(workflows);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(100);
      expect(result.added).toBe(50);
      expect(result.skipped).toBe(50);
    });
  });

  describe('validateWorkflow performance', () => {
    it('should validate 1000 workflows in under 100ms', () => {
      const workflows = generateMockWorkflows(1000);

      const start = Date.now();
      workflows.forEach(wf => service.validateWorkflow(wf));
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(100);
    });
  });

  describe('writeModelsFile performance', () => {
    it('should write 10 models in under 50ms', async () => {
      const models = generateMockModels(10);

      const start = Date.now();
      await service.writeModelsFile(models);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(50);
      expect(fs.existsSync(tempModelsPath)).toBe(true);
    });

    it('should write 100 models in under 100ms', async () => {
      const models = generateMockModels(100);

      const start = Date.now();
      await service.writeModelsFile(models);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(100);
      expect(fs.existsSync(tempModelsPath)).toBe(true);
    });

    it('should write 500 models in under 500ms', async () => {
      const models = generateMockModels(500);

      const start = Date.now();
      await service.writeModelsFile(models);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(500);
      expect(fs.existsSync(tempModelsPath)).toBe(true);
    });
  });

  describe('Full discovery cycle performance', () => {
    it('should complete discovery of 50 workflows in under 500ms', async () => {
      const workflows = generateMockWorkflows(50);
      mockN8nClient.getWorkflows.mockResolvedValue(workflows);
      mockN8nClient.extractWebhookUrl.mockImplementation((wf) =>
        `https://n8n.test/webhook/${wf.id}`
      );

      const start = Date.now();
      const result = await service.discover();
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(500);
      expect(result.success).toBe(true);
      expect(result.discovered).toBe(50);
    });

    it('should complete discovery of 200 workflows in under 2000ms', async () => {
      const workflows = generateMockWorkflows(200);
      mockN8nClient.getWorkflows.mockResolvedValue(workflows);
      mockN8nClient.extractWebhookUrl.mockImplementation((wf) =>
        `https://n8n.test/webhook/${wf.id}`
      );

      const start = Date.now();
      const result = await service.discover();
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(2000);
      expect(result.success).toBe(true);
      expect(result.discovered).toBe(200);
    });
  });

  describe('Memory usage', () => {
    it('should not leak memory processing workflows repeatedly', () => {
      const workflows = generateMockWorkflows(100);
      mockN8nClient.extractWebhookUrl.mockImplementation((wf) =>
        `https://n8n.test/webhook/${wf.id}`
      );

      const memBefore = process.memoryUsage().heapUsed;

      // Process 10 times
      for (let i = 0; i < 10; i++) {
        service.processWorkflows(workflows);
      }

      const memAfter = process.memoryUsage().heapUsed;
      const memDiff = (memAfter - memBefore) / 1024 / 1024; // MB

      // Should not grow more than 10MB
      expect(memDiff).toBeLessThan(10);
    });
  });
});

// Helper functions
function generateMockWorkflows(count, hasWebhook = true) {
  const workflows = [];

  for (let i = 0; i < count; i++) {
    workflows.push({
      id: `wf-${i}`,
      name: `Workflow ${i}`,
      active: Math.random() > 0.2, // 80% active
      tags: [{ name: 'n8n-openai-model' }],
      nodes: hasWebhook ? [
        {
          type: 'n8n-nodes-base.webhook',
          webhookId: `webhook-${i}`,
          parameters: {
            path: `path-${i}`,
          },
        },
        {
          type: 'n8n-nodes-base.someOtherNode',
        },
      ] : [
        {
          type: 'n8n-nodes-base.someOtherNode',
        },
      ],
    });
  }

  return workflows;
}

function generateMockModels(count) {
  const models = {};

  for (let i = 0; i < count; i++) {
    models[`Model ${i}`] = `https://n8n.test/webhook/webhook-${i}`;
  }

  return models;
}
