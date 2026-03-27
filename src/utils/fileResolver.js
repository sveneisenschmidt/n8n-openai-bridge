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
 * Resolve file_id references in chat completion messages to inline base64 data URLs.
 *
 * Handles two reference patterns:
 * 1. Attachments array: message.attachments[].file_id -> injected as image_url content parts
 * 2. Content parts: image_url.url starting with "file-" -> replaced with data URL
 *
 * @param {Array<Object>} messages - OpenAI chat messages
 * @param {import('../services/fileService')} fileService - FileService instance
 * @returns {Array<Object>} Messages with file references resolved to data URLs
 */
function resolveFileReferences(messages, fileService) {
  if (!messages || !Array.isArray(messages)) {
    return messages;
  }

  return messages.map((message) => {
    let resolved = message;

    // Pattern 1: Attachments array with file_id entries
    if (Array.isArray(message.attachments) && message.attachments.length > 0) {
      resolved = resolveAttachments(resolved, fileService);
    }

    // Pattern 2: Content parts with file-prefixed URLs
    if (Array.isArray(resolved.content)) {
      resolved = resolveContentParts(resolved, fileService);
    }

    return resolved;
  });
}

/**
 * Resolve attachments array by converting file_id references to inline content parts
 * @param {Object} message - Chat message with attachments
 * @param {import('../services/fileService')} fileService
 * @returns {Object} Message with attachments resolved into content parts
 */
function resolveAttachments(message, fileService) {
  const fileParts = [];

  for (const attachment of message.attachments) {
    if (!attachment.file_id) {
      continue;
    }

    const fileContent = fileService.getFileContent(attachment.file_id);
    if (!fileContent) {
      console.warn(
        `[${new Date().toISOString()}] File reference '${attachment.file_id}' not found (expired or never uploaded), skipping`,
      );
      continue;
    }

    const dataUrl = bufferToDataUrl(fileContent.buffer, fileContent.metadata.filename);
    fileParts.push({
      type: 'image_url',
      image_url: { url: dataUrl },
    });
  }

  if (fileParts.length === 0) {
    return message;
  }

  // Convert string content to array format if needed
  let contentParts;
  if (typeof message.content === 'string') {
    contentParts = message.content ? [{ type: 'text', text: message.content }] : [];
  } else if (Array.isArray(message.content)) {
    contentParts = [...message.content];
  } else {
    contentParts = [];
  }

  // Append file parts and remove attachments key
  const { attachments: _attachments, ...rest } = message;
  return {
    ...rest,
    content: [...contentParts, ...fileParts],
  };
}

/**
 * Resolve content parts where image_url.url starts with "file-"
 * @param {Object} message - Chat message with content array
 * @param {import('../services/fileService')} fileService
 * @returns {Object} Message with file references replaced by data URLs
 */
function resolveContentParts(message, fileService) {
  let changed = false;

  const resolvedContent = message.content.map((part) => {
    if (part.type !== 'image_url' || !part.image_url?.url) {
      return part;
    }

    const url = part.image_url.url;
    if (!url.startsWith('file-')) {
      return part;
    }

    const fileContent = fileService.getFileContent(url);
    if (!fileContent) {
      console.warn(
        `[${new Date().toISOString()}] File reference '${url}' not found (expired or never uploaded), skipping`,
      );
      return part;
    }

    changed = true;
    const dataUrl = bufferToDataUrl(fileContent.buffer, fileContent.metadata.filename);
    return {
      ...part,
      image_url: { ...part.image_url, url: dataUrl },
    };
  });

  if (!changed) {
    return message;
  }

  return { ...message, content: resolvedContent };
}

const { getMimeTypeFromFilename } = require('./mimeTypes');

/**
 * Convert a buffer to a base64 data URL
 * @param {Buffer} buffer - File content
 * @param {string} filename - Original filename (used for mime type detection)
 * @returns {string} Data URL (e.g., "data:image/png;base64,...")
 */
function bufferToDataUrl(buffer, filename) {
  const mimeType = getMimeTypeFromFilename(filename);
  const base64 = buffer.toString('base64');
  return `data:${mimeType};base64,${base64}`;
}

module.exports = {
  resolveFileReferences,
  resolveAttachments,
  resolveContentParts,
  bufferToDataUrl,
};
