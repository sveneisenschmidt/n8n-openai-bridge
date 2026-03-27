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

const express = require('express');
const multer = require('multer');
const { sendError } = require('../utils/errorResponse');
const FileService = require('../services/fileService');
const { getMimeTypeFromFilename } = require('../utils/mimeTypes');

const router = express.Router();

let cachedUpload = null;

/**
 * Get or create multer upload middleware configured from app config
 * @param {Object} config - Application config
 * @returns {Object} Multer upload instance
 */
function getUpload(config) {
  if (!cachedUpload) {
    cachedUpload = multer({
      storage: multer.memoryStorage(),
      limits: { fileSize: config.filesMaxFileSize },
    });
  }
  return cachedUpload;
}

/**
 * POST /v1/files
 * Upload a file (multipart/form-data)
 */
router.post(
  '/',
  (req, res, next) => {
    const config = req.app.locals.config;
    const upload = getUpload(config);

    upload.single('file')(req, res, (err) => {
      if (err) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return sendError(
            res,
            413,
            'File size exceeds maximum allowed size',
            'invalid_request_error',
          );
        }
        return sendError(res, 400, err.message, 'invalid_request_error');
      }
      next();
    });
  },
  (req, res) => {
    const fileService = req.app.locals.fileService;

    if (!req.file) {
      return sendError(res, 400, 'Missing required parameter: file', 'invalid_request_error');
    }

    const purpose = req.body.purpose;
    if (!purpose) {
      return sendError(res, 400, 'Missing required parameter: purpose', 'invalid_request_error');
    }

    if (!FileService.isValidPurpose(purpose)) {
      return sendError(
        res,
        400,
        `Invalid purpose. Valid purposes: ${FileService.VALID_PURPOSES.join(', ')}`,
        'invalid_request_error',
      );
    }

    try {
      const metadata = fileService.upload(req.file.originalname, purpose, req.file.buffer);
      res.status(200).json(metadata);
    } catch (error) {
      if (error.code === 'FILE_TOO_LARGE') {
        return sendError(res, 413, error.message, 'invalid_request_error');
      }
      if (error.code === 'STORAGE_LIMIT_EXCEEDED') {
        return sendError(res, 413, error.message, 'invalid_request_error');
      }
      console.error(`[${new Date().toISOString()}] Error uploading file: ${error.message}`);
      sendError(res, 500, 'Internal server error', 'server_error');
    }
  },
);

/**
 * GET /v1/files
 * List files with optional filtering
 */
router.get('/', (req, res) => {
  const fileService = req.app.locals.fileService;

  try {
    const result = fileService.listFiles({
      purpose: req.query.purpose,
      limit: req.query.limit,
      order: req.query.order,
      after: req.query.after,
    });
    res.status(200).json(result);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error listing files: ${error.message}`);
    sendError(res, 500, 'Internal server error', 'server_error');
  }
});

/**
 * GET /v1/files/:file_id
 * Retrieve file metadata
 */
router.get('/:file_id', (req, res) => {
  const fileService = req.app.locals.fileService;
  const fileId = req.params.file_id;

  const metadata = fileService.getFile(fileId);
  if (!metadata) {
    return sendError(res, 404, `File '${fileId}' not found`, 'invalid_request_error');
  }

  res.status(200).json(metadata);
});

/**
 * DELETE /v1/files/:file_id
 * Delete a file
 */
router.delete('/:file_id', (req, res) => {
  const fileService = req.app.locals.fileService;
  const fileId = req.params.file_id;

  const result = fileService.deleteFile(fileId);
  if (!result) {
    return sendError(res, 404, `File '${fileId}' not found`, 'invalid_request_error');
  }

  res.status(200).json(result);
});

/**
 * GET /v1/files/:file_id/content
 * Retrieve file binary content
 */
router.get('/:file_id/content', (req, res) => {
  const fileService = req.app.locals.fileService;
  const fileId = req.params.file_id;

  const fileContent = fileService.getFileContent(fileId);
  if (!fileContent) {
    return sendError(res, 404, `File '${fileId}' not found`, 'invalid_request_error');
  }

  const mimeType = getMimeTypeFromFilename(fileContent.metadata.filename);
  res.set('Content-Type', mimeType);
  res.set('Content-Disposition', `attachment; filename="${fileContent.metadata.filename}"`);
  res.send(fileContent.buffer);
});

module.exports = router;
