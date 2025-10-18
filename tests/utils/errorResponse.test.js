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

const { createErrorResponse, sendError } = require('../../src/utils/errorResponse');

describe('errorResponse utility', () => {
  describe('createErrorResponse', () => {
    it('should create error response with default type', () => {
      const response = createErrorResponse('Test error');
      expect(response).toEqual({
        error: {
          message: 'Test error',
          type: 'server_error',
        },
      });
    });

    it('should create error response with custom type', () => {
      const response = createErrorResponse('Auth failed', 'authentication_error');
      expect(response).toEqual({
        error: {
          message: 'Auth failed',
          type: 'authentication_error',
        },
      });
    });
  });

  describe('sendError', () => {
    let res;

    beforeEach(() => {
      res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      };
    });

    it('should send error with default type', () => {
      sendError(res, 500, 'Internal error');

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          message: 'Internal error',
          type: 'server_error',
        },
      });
    });

    it('should send error with custom type', () => {
      sendError(res, 401, 'Unauthorized', 'authentication_error');

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          message: 'Unauthorized',
          type: 'authentication_error',
        },
      });
    });

    it('should send error with 404 status', () => {
      sendError(res, 404, 'Not found', 'not_found_error');

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          message: 'Not found',
          type: 'not_found_error',
        },
      });
    });
  });
});
