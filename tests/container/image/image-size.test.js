/**
 * Image Size Tests
 * Validates Docker image size constraints
 *
 * Copyright (c) 2025 Sven Eisenschmidt
 * Licensed under AGPL-3.0
 */

const { execSync } = require('child_process');
const imageBuilder = require('../helpers/image-builder');
const { IMAGE_NAME, MAX_IMAGE_SIZE_MB } = require('../helpers/constants');

describe('Image Size', () => {
  let sizeMB;

  beforeAll(async () => {
    await imageBuilder.build();

    const imageInfo = execSync(`docker image inspect ${IMAGE_NAME} --format='{{.Size}}'`, {
      encoding: 'utf-8',
    }).trim();

    const sizeBytes = parseInt(imageInfo, 10);
    sizeMB = Math.round(sizeBytes / 1024 / 1024);

    console.log(`  Image size: ${sizeMB}MB`);
  }, 120000);

  test('should be less than maximum size', () => {
    expect(sizeMB).toBeLessThan(MAX_IMAGE_SIZE_MB);
  });

  test('should report size in MB', () => {
    expect(typeof sizeMB).toBe('number');
    expect(sizeMB).toBeGreaterThan(0);
  });
});
