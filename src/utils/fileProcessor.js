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
 * Service for processing multimodal content (images/files) in OpenAI messages
 *
 * Handles four modes:
 * - passthrough: Forward content as-is
 * - extract-json: Extract files to separate array with base64 data
 * - extract-multipart: Extract files for multipart/form-data upload
 * - extract-xlsx-json: Preserve image parts while extracting only XLSX file parts
 * - disabled: Strip all file content
 */

/**
 * Check if a message has multimodal content (array with image_url parts)
 * @param {Object} message - OpenAI message object
 * @returns {boolean} True if message contains multimodal content
 */
function isMultimodalMessage(message) {
  return Array.isArray(message.content);
}

/**
 * Parse a data URL and extract mime type and base64 data
 * @param {string} dataUrl - Data URL (e.g., "data:image/png;base64,iVBORw0...")
 * @returns {Object|null} { mimeType, data } or null if not a valid data URL
 */
function parseDataUrl(dataUrl) {
  if (!dataUrl || typeof dataUrl !== 'string') {
    return null;
  }

  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    return null;
  }

  return {
    mimeType: match[1],
    data: match[2],
  };
}

const { getExtensionFromMimeType } = require('./mimeTypes');

/**
 * Extract text content from a multimodal message
 * @param {Object} message - OpenAI message with array content
 * @returns {string} Combined text content
 */
function extractTextFromMultimodal(message) {
  if (!isMultimodalMessage(message)) {
    return message.content || '';
  }

  return message.content
    .filter((part) => part.type === 'text')
    .map((part) => part.text)
    .join('\n');
}

/**
 * Extract files from a multimodal message
 * @param {Object} message - OpenAI message with array content
 * @param {number} messageIndex - Index of message for naming files
 * @returns {Array<Object>} Array of { name, mimeType, data } objects
 */
function extractFilesFromMultimodal(message, messageIndex) {
  if (!isMultimodalMessage(message)) {
    return [];
  }

  const files = [];
  let fileIndex = 0;

  for (const part of message.content) {
    const isImage = part.type === 'image_url';
    const isXlsxFile = part.type === 'file';
    const dataUrl = isImage
      ? part.image_url?.url
      : isXlsxFile
        ? part.file?.url || part.file_url?.url
        : null;
    if (!dataUrl) {
      continue;
    }
    const parsed = parseDataUrl(dataUrl);
    if (!parsed) {
      continue;
    }
    // The bridge keeps generic image behaviour unchanged, but only forwards
    // XLSX documents as files. This avoids accidentally widening document
    // exfiltration to n8n workflows that were never designed to handle them.
    if (
      isXlsxFile &&
      parsed.mimeType !== 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ) {
      continue;
    }
    const suppliedName = part.file?.filename || part.file_url?.filename || part.filename;
    const ext = getExtensionFromMimeType(parsed.mimeType);
    const sanitizedName =
      typeof suppliedName === 'string' ? suppliedName.trim().replace(/[\\/\x00-\x1f]/g, '_') : '';
    const name = sanitizedName
      ? sanitizedName.slice(0, 200)
      : `message_${messageIndex}_file_${fileIndex}.${ext}`;
    files.push({ name, mimeType: parsed.mimeType, data: parsed.data });
    fileIndex++;
  }

  return files;
}

/**
 * Process messages according to file upload mode
 * @param {Array<Object>} messages - OpenAI messages array
 * @param {string} mode - File upload mode (passthrough, extract-json, extract-multipart, disabled)
 * @returns {Object} { messages, files } - Processed messages and extracted files
 */
function processMessages(messages, mode) {
  if (mode === 'passthrough') {
    return { messages, files: [] };
  }

  const processedMessages = [];
  const allFiles = [];

  for (let i = 0; i < messages.length; i++) {
    const message = messages[i];

    if (!isMultimodalMessage(message)) {
      processedMessages.push(message);
      continue;
    }

    // Extract text content
    const textContent = extractTextFromMultimodal(message);

    if (mode === 'disabled') {
      // Strip files, keep only text
      processedMessages.push({
        ...message,
        content: textContent,
      });
    } else if (mode === 'extract-xlsx-json') {
      // Keep image content intact for existing vision workflows while forwarding
      // only the bounded XLSX attachment bytes in the separate files array.
      const files = extractFilesFromMultimodal(message, i).filter(
        (file) =>
          file.mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      allFiles.push(...files);
      processedMessages.push({
        ...message,
        content: message.content.filter((part) => part.type !== 'file'),
      });
    } else {
      // extract-json or extract-multipart
      const files = extractFilesFromMultimodal(message, i);
      allFiles.push(...files);
      processedMessages.push({
        ...message,
        content: textContent,
      });
    }
  }

  return { messages: processedMessages, files: allFiles };
}

/**
 * Convert extracted files to Buffer objects for multipart upload
 * @param {Array<Object>} files - Array of { name, mimeType, data } objects
 * @returns {Array<Object>} Array of { name, mimeType, buffer } objects
 */
function filesToBuffers(files) {
  return files.map((file) => ({
    name: file.name,
    mimeType: file.mimeType,
    buffer: Buffer.from(file.data, 'base64'),
  }));
}

module.exports = {
  isMultimodalMessage,
  parseDataUrl,
  getExtensionFromMimeType,
  extractTextFromMultimodal,
  extractFilesFromMultimodal,
  processMessages,
  filesToBuffers,
};
