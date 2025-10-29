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

/**
 * Service for detecting automated task generation requests
 * from OpenWebUI, LibreChat, and similar clients.
 *
 * Uses a callback-based registry pattern to allow extensibility.
 */
class TaskDetectorService {
  constructor() {
    this.detectors = new Map();
  }

  /**
   * Registers a task detector callback
   *
   * @param {string} taskType - Task type from TaskType enum
   * @param {Function} callback - Detection function (messages) => boolean
   */
  registerDetector(taskType, callback) {
    if (typeof callback !== 'function') {
      throw new Error('Detector callback must be a function');
    }
    this.detectors.set(taskType, callback);
  }

  /**
   * Detects if messages represent an automated task
   *
   * @param {Array<Object>} messages - Chat messages array
   * @returns {Object} { isTask: boolean, taskType: string|null }
   */
  detectTask(messages) {
    if (!Array.isArray(messages) || messages.length === 0) {
      return { isTask: false, taskType: null };
    }

    // Run all registered detectors
    for (const [taskType, detector] of this.detectors.entries()) {
      try {
        if (detector(messages)) {
          return { isTask: true, taskType };
        }
      } catch (error) {
        console.error(
          `[${new Date().toISOString()}] Task detector error for ${taskType}:`,
          error.message,
        );
      }
    }

    return { isTask: false, taskType: null };
  }

  /**
   * Clears all registered detectors (useful for testing)
   */
  clearDetectors() {
    this.detectors.clear();
  }
}

module.exports = TaskDetectorService;
