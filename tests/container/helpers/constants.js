/**
 * Shared constants for integration tests
 *
 * Copyright (c) 2025 Sven Eisenschmidt
 * Licensed under AGPL-3.0
 */

// Container tests always run inside Docker container
// Full project is mounted at /build-context for Docker-in-Docker access
const PROJECT_ROOT = '/build-context';

module.exports = {
  IMAGE_NAME: 'n8n-openai-bridge:test-build',
  PROJECT_ROOT,
  DOCKERFILE_PATH: '/build-context/docker/Dockerfile.build',
  DEFAULT_PORT: 3333,
  NODE_VERSION_MAJOR: 20,
  MAX_IMAGE_SIZE_MB: 500,
};
