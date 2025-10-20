/**
 * Image Builder Helper
 * Handles Docker image building and caching for tests
 *
 * Copyright (c) 2025 Sven Eisenschmidt
 * Licensed under AGPL-3.0
 */

const { execSync } = require('child_process');
const { IMAGE_NAME, PROJECT_ROOT, DOCKERFILE_PATH } = require('./constants');

class ImageBuilder {
  constructor() {
    this.imageId = null;
    this.built = false;
  }

  /**
   * Build the Docker image if not already built
   * @returns {Promise<string>} Image ID
   */
  async build() {
    if (this.built && this.imageId) {
      return this.imageId;
    }

    console.log('Building production Docker image...');

    try {
      const buildCommand = `DOCKER_BUILDKIT=1 docker build -f ${DOCKERFILE_PATH} -t ${IMAGE_NAME} ${PROJECT_ROOT}`;
      execSync(buildCommand, { stdio: 'pipe', env: { ...process.env, DOCKER_BUILDKIT: '1' } });

      this.imageId = execSync(`docker images -q ${IMAGE_NAME}`, {
        encoding: 'utf-8',
      }).trim();

      this.built = true;

      console.log(`✓ Image built successfully: ${this.imageId.substring(0, 12)}`);
      return this.imageId;
    } catch (error) {
      throw new Error(`Failed to build Docker image: ${error.message}`);
    }
  }

  /**
   * Check if image exists
   * @returns {boolean}
   */
  exists() {
    try {
      const imageId = execSync(`docker images -q ${IMAGE_NAME}`, {
        encoding: 'utf-8',
      }).trim();
      return imageId.length > 0;
    } catch {
      return false;
    }
  }

  /**
   * Get image ID
   * @returns {string|null}
   */
  getImageId() {
    return this.imageId;
  }

  /**
   * Clean up image
   */
  cleanup() {
    if (this.imageId) {
      try {
        execSync(`docker rmi ${IMAGE_NAME}`, { stdio: 'pipe' });
        this.imageId = null;
        this.built = false;
      } catch {
        // Ignore cleanup errors
      }
    }
  }
}

// Singleton instance
const imageBuilder = new ImageBuilder();

module.exports = imageBuilder;
