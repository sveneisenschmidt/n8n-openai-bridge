/**
 * Security Tests
 * Tests user permissions, working directory, and security settings
 *
 * Copyright (c) 2025 Sven Eisenschmidt
 * Licensed under AGPL-3.0
 */

const imageBuilder = require('../helpers/image-builder');
const { execInContainer } = require('../helpers/container-exec');

describe('Security', () => {
  beforeAll(async () => {
    await imageBuilder.build();
  }, 120000);

  describe('User Permissions', () => {
    test('should run as non-root user', async () => {
      const userId = await execInContainer('id -u');
      const uid = parseInt(userId, 10);
      expect(uid).not.toBe(0);
    });

    test('should have node user', async () => {
      const username = await execInContainer('whoami');
      expect(username).toBe('node');
    });

    test('should have valid group ID', async () => {
      const groupId = await execInContainer('id -g');
      const gid = parseInt(groupId, 10);
      expect(gid).toBeGreaterThan(0);
    });
  });

  describe('Working Directory', () => {
    test('should have /app as working directory', async () => {
      const workdir = await execInContainer('pwd');
      expect(workdir).toBe('/app');
    });

    test('should have read access to /app', async () => {
      const output = await execInContainer('test -r /app && echo "readable"');
      expect(output).toContain('readable');
    });
  });

  describe('File Permissions', () => {
    test('should have readable server.js', async () => {
      const output = await execInContainer('test -r /app/src/server.js && echo "readable"');
      expect(output).toContain('readable');
    });

    test('should have readable models.json', async () => {
      const output = await execInContainer('test -r /app/models.json && echo "readable"');
      expect(output).toContain('readable');
    });

    test('should have readable .env', async () => {
      const output = await execInContainer('test -r /app/.env && echo "readable"');
      expect(output).toContain('readable');
    });
  });
});
