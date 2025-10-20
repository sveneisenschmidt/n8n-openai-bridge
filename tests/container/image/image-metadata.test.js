/**
 * Image Metadata Tests
 * Tests Docker image labels, ports, entrypoint, and CMD
 *
 * Copyright (c) 2025 Sven Eisenschmidt
 * Licensed under AGPL-3.0
 */

const { execSync } = require('child_process');
const imageBuilder = require('../helpers/image-builder');
const { IMAGE_NAME, DEFAULT_PORT } = require('../helpers/constants');

describe('Image Metadata', () => {
  beforeAll(async () => {
    await imageBuilder.build();
  }, 120000);

  describe('Exposed Ports', () => {
    test('should expose default port 3333', () => {
      const exposedPorts = JSON.parse(
        execSync(`docker image inspect ${IMAGE_NAME} --format='{{json .Config.ExposedPorts}}'`, {
          encoding: 'utf-8',
        }).trim(),
      );

      expect(exposedPorts).toHaveProperty(`${DEFAULT_PORT}/tcp`);
    });
  });

  describe('Entrypoint and CMD', () => {
    test('should have correct CMD to start server', () => {
      const cmd = JSON.parse(
        execSync(`docker image inspect ${IMAGE_NAME} --format='{{json .Config.Cmd}}'`, {
          encoding: 'utf-8',
        }).trim(),
      );

      expect(cmd).toBeDefined();
      expect(cmd).toContain('node');
      expect(cmd.join(' ')).toContain('server.js');
    });
  });

  describe('Environment Variables', () => {
    test('should have NODE_ENV set', () => {
      const env = JSON.parse(
        execSync(`docker image inspect ${IMAGE_NAME} --format='{{json .Config.Env}}'`, {
          encoding: 'utf-8',
        }).trim(),
      );

      const nodeEnv = env.find((e) => e.startsWith('NODE_ENV='));
      expect(nodeEnv).toBeDefined();
    });
  });

  describe('Base Image', () => {
    test('should be based on Node.js Alpine', () => {
      const history = execSync(
        `docker history ${IMAGE_NAME} --no-trunc --format='{{.CreatedBy}}'`,
        {
          encoding: 'utf-8',
        },
      );

      expect(history).toMatch(/node.*alpine/i);
    });
  });
});
