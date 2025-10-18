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

const { debugSessionDetection } = require('../../src/utils/debugSession');

describe('debugSession utility', () => {
  let consoleLogSpy;
  let req;
  let config;

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    
    req = {
      body: {
        session_id: 'test-session-123',
        conversation_id: 'conv-456',
      },
      headers: {
        'x-session-id': 'header-session-789',
        'x-user-id': 'user-123',
      },
    };

    config = {
      logRequests: false,
      sessionIdHeaders: ['x-session-id', 'x-conversation-id'],
    };
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  describe('debugSessionDetection', () => {
    it('should not log when logRequests is false', () => {
      debugSessionDetection(req, config);
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it('should log session detection info when logRequests is true', () => {
      config.logRequests = true;
      debugSessionDetection(req, config);

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('SESSION ID DETECTION'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('req.body.session_id: test-session-123'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('req.body.conversation_id: conv-456'));
    });

    it('should log NOT FOUND for missing values', () => {
      config.logRequests = true;
      req.body = {};
      debugSessionDetection(req, config);

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('req.body.session_id: NOT FOUND'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('req.body.conversation_id: NOT FOUND'));
    });

    it('should log configured session ID headers', () => {
      config.logRequests = true;
      debugSessionDetection(req, config);

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('x-session-id: header-session-789'));
    });

    it('should log all request body and header keys', () => {
      config.logRequests = true;
      debugSessionDetection(req, config);

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('All request body keys:'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('All header keys:'));
    });
  });
});
