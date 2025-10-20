/**
 * File Structure Tests
 * Tests directory structure and file exclusions
 *
 * Copyright (c) 2025 Sven Eisenschmidt
 * Licensed under AGPL-3.0
 */

const imageBuilder = require('../helpers/image-builder');
const { fileExists, directoryExists } = require('../helpers/container-exec');

describe('File Structure', () => {
  beforeAll(async () => {
    await imageBuilder.build();
  }, 120000);

  describe('Required Directories', () => {
    test('should have /app/src directory', async () => {
      const exists = await directoryExists('/app/src');
      expect(exists).toBe(true);
    });

    test('should have /app/node_modules directory', async () => {
      const exists = await directoryExists('/app/node_modules');
      expect(exists).toBe(true);
    });
  });

  describe('Required Files', () => {
    test('should have package.json', async () => {
      const exists = await fileExists('/app/package.json');
      expect(exists).toBe(true);
    });

    test('should have server.js', async () => {
      const exists = await fileExists('/app/src/server.js');
      expect(exists).toBe(true);
    });

    test('should have config.js', async () => {
      const exists = await fileExists('/app/src/config.js');
      expect(exists).toBe(true);
    });

    test('should have n8nClient.js', async () => {
      const exists = await fileExists('/app/src/n8nClient.js');
      expect(exists).toBe(true);
    });
  });

  describe('Excluded Files and Directories', () => {
    test('should not have tests directory', async () => {
      const exists = await directoryExists('/app/tests');
      expect(exists).toBe(false);
    });

    test('should not have .git directory', async () => {
      const exists = await directoryExists('/app/.git');
      expect(exists).toBe(false);
    });

    test('should not have coverage directory', async () => {
      const exists = await directoryExists('/app/coverage');
      expect(exists).toBe(false);
    });

    test('should not have .github directory', async () => {
      const exists = await directoryExists('/app/.github');
      expect(exists).toBe(false);
    });

    test('should not have docker directory', async () => {
      const exists = await directoryExists('/app/docker');
      expect(exists).toBe(false);
    });
  });
});
