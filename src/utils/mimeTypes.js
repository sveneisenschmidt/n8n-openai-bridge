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
 * Shared MIME type <-> file extension mappings
 */

const MIME_TO_EXT = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
  'application/pdf': 'pdf',
  'text/plain': 'txt',
  'application/json': 'json',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'text/csv': 'csv',
};

// Build reverse map (ext -> mime), skip duplicate extensions (first wins)
const EXT_TO_MIME = {};
for (const [mime, ext] of Object.entries(MIME_TO_EXT)) {
  if (!EXT_TO_MIME[ext]) {
    EXT_TO_MIME[ext] = mime;
  }
}
// Add jpeg alias explicitly (MIME_TO_EXT maps both image/jpeg and image/jpg to 'jpg')
EXT_TO_MIME['jpeg'] = 'image/jpeg';

/**
 * Get file extension from MIME type
 * @param {string} mimeType - MIME type (e.g., "image/png")
 * @returns {string} File extension (e.g., "png"), or "bin" if unknown
 */
function getExtensionFromMimeType(mimeType) {
  return MIME_TO_EXT[mimeType] || 'bin';
}

/**
 * Get MIME type from filename extension
 * @param {string} filename - Filename (e.g., "doc.pdf")
 * @returns {string} MIME type, or "application/octet-stream" if unknown
 */
function getMimeTypeFromFilename(filename) {
  const ext = (filename || '').split('.').pop().toLowerCase();
  return EXT_TO_MIME[ext] || 'application/octet-stream';
}

module.exports = {
  MIME_TO_EXT,
  EXT_TO_MIME,
  getExtensionFromMimeType,
  getMimeTypeFromFilename,
};
