/*
 * n8n OpenAI Bridge
 * Copyright (C) 2025 Sven Eisenschmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

const fs = require('fs');
const path = require('path');

/**
 * Setup test directory in /tmp for loader tests
 * Ensures clean environment for file operations in Docker
 *
 * @returns {Object} { testDir, createTestFile, cleanup }
 */
function setupLoaderTestDir() {
  const testDir = '/tmp/test-data';

  // Ensure test directory exists
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }

  /**
   * Create a test file with models data
   * @param {string} filename - Name of the file to create
   * @param {Object} models - Models object to write
   * @returns {string} Full path to created file
   */
  const createTestFile = (filename, models) => {
    const testFile = path.join(testDir, filename);
    fs.writeFileSync(testFile, JSON.stringify(models, null, 2));
    return testFile;
  };

  /**
   * Get full path for a test file
   * @param {string} filename - Name of the file
   * @returns {string} Full path to file
   */
  const getTestFilePath = (filename) => {
    return path.join(testDir, filename);
  };

  /**
   * Cleanup all test files in the test directory
   */
  const cleanup = () => {
    if (fs.existsSync(testDir)) {
      const files = fs.readdirSync(testDir);
      files.forEach((file) => {
        const filePath = path.join(testDir, file);
        if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
          fs.unlinkSync(filePath);
        }
      });
    }
  };

  return { testDir, createTestFile, getTestFilePath, cleanup };
}

module.exports = { setupLoaderTestDir };
