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
 * FileRepository - In-Memory File Storage
 *
 * Responsibilities:
 * - Store and retrieve file metadata and binary data
 * - Track total storage usage
 * - Provide listing with filtering and pagination
 *
 * Does NOT:
 * - Validate files or enforce limits (see FileService)
 * - Handle expiration logic (see FileService)
 * - Parse configuration (see Config)
 */
class FileRepository {
  constructor() {
    /** @type {Map<string, {metadata: Object, buffer: Buffer}>} */
    this.files = new Map();

    /** @type {number} */
    this.totalBytes = 0;
  }

  /**
   * Store a file entry
   * @param {string} fileId - The file identifier
   * @param {Object} entry - The file entry
   * @param {Object} entry.metadata - OpenAI file object metadata (includes expires_at)
   * @param {Buffer} entry.buffer - Raw file content
   */
  store(fileId, entry) {
    const existing = this.files.get(fileId);
    if (existing) {
      this.totalBytes -= existing.metadata.bytes;
    }
    this.files.set(fileId, entry);
    this.totalBytes += entry.metadata.bytes;
  }

  /**
   * Get a file entry by ID
   * @param {string} fileId - The file identifier
   * @returns {{metadata: Object, buffer: Buffer}|undefined}
   */
  get(fileId) {
    return this.files.get(fileId);
  }

  /**
   * Delete a file by ID
   * @param {string} fileId - The file identifier
   * @returns {boolean} True if file was deleted
   */
  delete(fileId) {
    const entry = this.files.get(fileId);
    if (!entry) {
      return false;
    }
    this.totalBytes -= entry.metadata.bytes;
    this.files.delete(fileId);
    return true;
  }

  /**
   * List files with optional filtering and pagination
   * @param {Object} [options={}]
   * @param {string} [options.purpose] - Filter by purpose
   * @param {number} [options.limit=10000] - Max results
   * @param {string} [options.order='desc'] - Sort order by created_at ('asc' or 'desc')
   * @param {string} [options.after] - Cursor: return files after this ID
   * @returns {Array<Object>} Array of file metadata objects
   */
  list({ purpose, limit = 10000, order = 'desc', after } = {}) {
    let entries = Array.from(this.files.values()).map((entry) => entry.metadata);

    // Filter by purpose
    if (purpose) {
      entries = entries.filter((m) => m.purpose === purpose);
    }

    // Sort by created_at
    entries.sort((a, b) =>
      order === 'asc' ? a.created_at - b.created_at : b.created_at - a.created_at,
    );

    // Pagination: skip entries until after cursor
    if (after) {
      const idx = entries.findIndex((m) => m.id === after);
      if (idx !== -1) {
        entries = entries.slice(idx + 1);
      }
    }

    // Apply limit
    return entries.slice(0, limit);
  }

  /**
   * Get all file entries (for cleanup iteration)
   * @returns {Map<string, {metadata: Object, buffer: Buffer}>}
   */
  getAll() {
    return this.files;
  }

  /**
   * Get current total storage in bytes
   * @returns {number}
   */
  getTotalBytes() {
    return this.totalBytes;
  }

  /**
   * Get number of stored files
   * @returns {number}
   */
  getCount() {
    return this.files.size;
  }

  /**
   * Remove all files
   */
  clear() {
    this.files.clear();
    this.totalBytes = 0;
  }
}

module.exports = FileRepository;
