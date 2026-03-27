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

const { v4: uuidv4 } = require('uuid');

/**
 * FileService - Business Logic for In-Memory File Operations
 *
 * Responsibilities:
 * - Validate file uploads (size, storage limits)
 * - Generate file IDs and metadata
 * - Manage TTL-based file expiration
 * - Provide file query operations
 *
 * Does NOT:
 * - Handle HTTP requests (see routes/files.js)
 * - Store files directly (see FileRepository)
 * - Parse configuration (see Config)
 */
class FileService {
  /**
   * Valid purpose values for file uploads
   * @type {string[]}
   */
  static VALID_PURPOSES = ['assistants', 'batch', 'fine-tune', 'vision', 'user_data', 'evals'];

  /**
   * @param {import('../repositories/FileRepository')} fileRepository
   * @param {import('../config/Config')} config
   */
  constructor(fileRepository, config) {
    this.fileRepository = fileRepository;
    this.config = config;
    this.cleanupTimer = null;
  }

  /**
   * Upload a file to in-memory storage
   * @param {string} filename - Original filename
   * @param {string} purpose - File purpose (e.g., 'assistants', 'vision')
   * @param {Buffer} buffer - File content
   * @returns {Object} OpenAI file object
   * @throws {Error} If file exceeds size limit or storage is full
   */
  upload(filename, purpose, buffer) {
    const bytes = buffer.length;

    if (bytes > this.config.filesMaxFileSize) {
      const error = new Error(
        `File size ${bytes} bytes exceeds maximum of ${this.config.filesMaxFileSize} bytes`,
      );
      error.code = 'FILE_TOO_LARGE';
      throw error;
    }

    if (this.fileRepository.getTotalBytes() + bytes > this.config.filesMaxTotalStorage) {
      const error = new Error('Total file storage limit exceeded');
      error.code = 'STORAGE_LIMIT_EXCEEDED';
      throw error;
    }

    const fileId = FileService.generateFileId();
    const now = Math.floor(Date.now() / 1000);

    const metadata = {
      id: fileId,
      object: 'file',
      bytes,
      created_at: now,
      filename,
      purpose,
      status: 'processed',
      expires_at: now + this.config.filesTtlSeconds,
    };

    this.fileRepository.store(fileId, {
      metadata,
      buffer,
    });

    return metadata;
  }

  /**
   * Get file metadata by ID
   * @param {string} fileId - The file identifier
   * @returns {Object|null} File metadata or null if not found
   */
  getFile(fileId) {
    const entry = this.fileRepository.get(fileId);
    if (!entry) {
      return null;
    }
    if (FileService.isExpired(entry)) {
      this.fileRepository.delete(fileId);
      return null;
    }
    return entry.metadata;
  }

  /**
   * Get file binary content by ID
   * @param {string} fileId - The file identifier
   * @returns {{buffer: Buffer, metadata: Object}|null} File content and metadata, or null
   */
  getFileContent(fileId) {
    const entry = this.fileRepository.get(fileId);
    if (!entry) {
      return null;
    }
    if (FileService.isExpired(entry)) {
      this.fileRepository.delete(fileId);
      return null;
    }
    return { buffer: entry.buffer, metadata: entry.metadata };
  }

  /**
   * Delete a file by ID
   * @param {string} fileId - The file identifier
   * @returns {Object|null} Deletion confirmation or null if not found
   */
  deleteFile(fileId) {
    const deleted = this.fileRepository.delete(fileId);
    if (!deleted) {
      return null;
    }
    return {
      id: fileId,
      object: 'file',
      deleted: true,
    };
  }

  /**
   * List files with optional filtering
   * @param {Object} [options] - Filtering options
   * @returns {{data: Array<Object>, has_more: boolean}} Paginated file list
   */
  listFiles(options = {}) {
    const limit = Math.min(Math.max(parseInt(options.limit) || 10000, 1), 10000);
    const data = this.fileRepository.list({
      purpose: options.purpose,
      limit: limit + 1,
      order: options.order || 'desc',
      after: options.after,
    });

    const hasMore = data.length > limit;
    return {
      object: 'list',
      data: data.slice(0, limit),
      has_more: hasMore,
    };
  }

  /**
   * Remove expired files from storage
   * @returns {number} Number of files cleaned up
   */
  cleanup() {
    const now = Math.floor(Date.now() / 1000);
    const expiredIds = [];

    for (const [fileId, entry] of this.fileRepository.getAll()) {
      if (entry.metadata.expires_at <= now) {
        expiredIds.push(fileId);
      }
    }

    for (const fileId of expiredIds) {
      this.fileRepository.delete(fileId);
    }

    const cleaned = expiredIds.length;

    if (cleaned > 0) {
      console.log(
        `[${new Date().toISOString()}] File cleanup: removed ${cleaned} expired file(s), ${this.fileRepository.getCount()} remaining`,
      );
    }

    return cleaned;
  }

  /**
   * Start periodic cleanup interval
   */
  startCleanupInterval() {
    if (this.cleanupTimer) {
      return;
    }
    this.cleanupTimer = setInterval(
      () => this.cleanup(),
      this.config.filesCleanupIntervalSeconds * 1000,
    );
    // Allow process to exit even if timer is active
    if (this.cleanupTimer.unref) {
      this.cleanupTimer.unref();
    }
  }

  /**
   * Stop periodic cleanup interval
   */
  stopCleanupInterval() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  /**
   * Generate a unique file ID
   * @returns {string} File ID in format "file-{uuid}"
   */
  static generateFileId() {
    return `file-${uuidv4()}`;
  }

  /**
   * Check if a purpose value is valid
   * @param {string} purpose
   * @returns {boolean}
   */
  static isValidPurpose(purpose) {
    return FileService.VALID_PURPOSES.includes(purpose);
  }

  /**
   * Check if a file entry has expired
   * @param {{metadata: {expires_at: number}}} entry
   * @returns {boolean}
   */
  static isExpired(entry) {
    return entry.metadata.expires_at <= Math.floor(Date.now() / 1000);
  }
}

module.exports = FileService;
