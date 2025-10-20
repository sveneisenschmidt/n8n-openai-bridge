/**
 * Image Build Tests
 * Tests basic Docker image build validation
 *
 * Copyright (c) 2025 Sven Eisenschmidt
 * Licensed under AGPL-3.0
 */

const imageBuilder = require('../helpers/image-builder');

describe('Image Build', () => {
  let imageId;

  beforeAll(async () => {
    imageId = await imageBuilder.build();
  }, 120000); // 2 minutes timeout

  test('should build successfully', () => {
    expect(imageId).toBeDefined();
    expect(imageId).not.toBe('');
    expect(imageId.length).toBeGreaterThan(0);
  });

  test('should create image with correct name', () => {
    expect(imageBuilder.exists()).toBe(true);
  });

  test('should have valid image ID format', () => {
    expect(imageId).toMatch(/^[a-f0-9]{12,64}$/);
  });
});
