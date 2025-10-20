/**
 * Container Execution Helper
 * Simplified command execution in containers
 *
 * Copyright (c) 2025 Sven Eisenschmidt
 * Licensed under AGPL-3.0
 */

const { GenericContainer } = require('testcontainers');
const { IMAGE_NAME } = require('./constants');

/**
 * Execute a command in a container and return output
 * @param {string|string[]} command - Command to execute
 * @param {Object} options - Execution options
 * @returns {Promise<string>} Command output
 */
async function execInContainer(command, options = {}) {
  const { timeout = 10000, trim = true } = options;

  const cmdArray = Array.isArray(command) ? command : ['sh', '-c', command];

  const container = await new GenericContainer(IMAGE_NAME)
    .withCommand(cmdArray)
    .withStartupTimeout(timeout)
    .start();

  // Get logs as a stream
  const stream = await container.logs();

  // Read from stream
  let output = '';
  return new Promise((resolve, reject) => {
    stream
      .on('data', (chunk) => {
        output += chunk.toString();
      })
      .on('end', async () => {
        await container.stop();
        resolve(trim ? output.trim() : output);
      })
      .on('error', async (err) => {
        await container.stop();
        reject(err);
      });
  });
}

/**
 * Check if a file exists in the container
 * @param {string} filePath - Path to check
 * @returns {Promise<boolean>}
 */
async function fileExists(filePath) {
  const output = await execInContainer(`test -f ${filePath} && echo "exists" || echo "not-found"`);
  return output.includes('exists');
}

/**
 * Check if a directory exists in the container
 * @param {string} dirPath - Path to check
 * @returns {Promise<boolean>}
 */
async function directoryExists(dirPath) {
  const output = await execInContainer(`test -d ${dirPath} && echo "exists" || echo "not-found"`);
  return output.includes('exists');
}

/**
 * Read file content from container
 * @param {string} filePath - Path to file
 * @returns {Promise<string>} File content
 */
async function readFile(filePath) {
  return execInContainer(`cat ${filePath}`);
}

/**
 * Get file permissions
 * @param {string} filePath - Path to file
 * @returns {Promise<string>} Permissions string
 */
async function getPermissions(filePath) {
  return execInContainer(`stat -c '%a' ${filePath} 2>/dev/null || stat -f '%Lp' ${filePath}`);
}

module.exports = {
  execInContainer,
  fileExists,
  directoryExists,
  readFile,
  getPermissions,
};
