/**
 * Dependencies Tests
 * Tests Node.js version and installed packages
 *
 * Copyright (c) 2025 Sven Eisenschmidt
 * Licensed under AGPL-3.0
 */

const imageBuilder = require('../helpers/image-builder');
const { execInContainer } = require('../helpers/container-exec');
const { NODE_VERSION_MAJOR } = require('../helpers/constants');

describe('Dependencies', () => {
  beforeAll(async () => {
    await imageBuilder.build();
  }, 120000);

  describe('Node.js Version', () => {
    test('should have correct major version', async () => {
      const nodeVersion = await execInContainer('node --version');
      expect(nodeVersion).toMatch(new RegExp(`^v${NODE_VERSION_MAJOR}\\.`));
    });

    test('should have npm installed', async () => {
      const npmVersion = await execInContainer('npm --version');
      expect(npmVersion).toMatch(/^\d+\.\d+\.\d+/);
    });
  });

  describe('Production Dependencies', () => {
    let npmList;
    const requiredDependencies = [
      'express',
      'axios',
      'dotenv',
      'cors',
      'uuid',
      'express-rate-limit',
    ];

    beforeAll(async () => {
      npmList = await execInContainer('cd /app && npm list --depth=0 2>/dev/null || true');
    });

    requiredDependencies.forEach((dependency) => {
      test(`should have ${dependency} installed`, () => {
        expect(npmList).toContain(`${dependency}@`);
      });
    });
  });

  describe('Dev Dependencies Exclusion', () => {
    let npmList;
    const excludedDevDependencies = [
      'jest',
      'nodemon',
      'supertest',
      'eslint',
      'prettier',
      'testcontainers',
    ];

    beforeAll(async () => {
      npmList = await execInContainer('cd /app && npm list --depth=0 2>/dev/null || true');
    });

    // Helper to check if a package is actually installed (not UNMET)
    const isInstalled = (packageName) => {
      const regex = new RegExp(`^[+├└]── ${packageName}@`, 'm');
      return regex.test(npmList);
    };

    excludedDevDependencies.forEach((dependency) => {
      test(`should not have ${dependency} installed`, () => {
        expect(isInstalled(dependency)).toBe(false);
      });
    });
  });
});
