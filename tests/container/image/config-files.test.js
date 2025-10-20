/**
 * Configuration Files Tests
 * Tests .env and models.json files in the image
 *
 * Copyright (c) 2025 Sven Eisenschmidt
 * Licensed under AGPL-3.0
 */

const imageBuilder = require('../helpers/image-builder');
const { fileExists, readFile } = require('../helpers/container-exec');

describe('Configuration Files', () => {
  beforeAll(async () => {
    await imageBuilder.build();
  }, 120000);

  describe('.env file', () => {
    test('should exist in /app directory', async () => {
      const exists = await fileExists('/app/.env');
      expect(exists).toBe(true);
    });

    test('should contain BEARER_TOKEN placeholder', async () => {
      const content = await readFile('/app/.env');
      expect(content).toContain('BEARER_TOKEN=change-me');
    });

    test('should contain PORT configuration', async () => {
      const content = await readFile('/app/.env');
      expect(content).toContain('PORT=3333');
    });

    test('should be valid env file format', async () => {
      const content = await readFile('/app/.env');
      const lines = content.split('\n').filter((l) => l.trim() && !l.startsWith('#'));

      lines.forEach((line) => {
        // Should match KEY=VALUE format (value can be empty)
        expect(line).toMatch(/^[A-Z_0-9]+=.*$/);
      });
    });
  });

  describe('models.json file', () => {
    test('should exist in /app directory', async () => {
      const exists = await fileExists('/app/models.json');
      expect(exists).toBe(true);
    });

    test('should contain valid JSON', async () => {
      const content = await readFile('/app/models.json');
      expect(() => JSON.parse(content)).not.toThrow();
    });

    test('should have correct structure', async () => {
      const content = await readFile('/app/models.json');
      const models = JSON.parse(content);

      expect(models).toBeDefined();
      expect(typeof models).toBe('object');
      expect(Array.isArray(models)).toBe(false);
    });

    test('should contain example model with webhook URL', async () => {
      const content = await readFile('/app/models.json');
      const models = JSON.parse(content);

      const firstModel = Object.values(models)[0];
      expect(firstModel).toMatch(/^https?:\/\/.+\/webhook\/.+/);
    });

    test('should have at least one model configured', async () => {
      const content = await readFile('/app/models.json');
      const models = JSON.parse(content);

      expect(Object.keys(models).length).toBeGreaterThan(0);
    });
  });
});
