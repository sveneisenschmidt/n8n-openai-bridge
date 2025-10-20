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

const requestLogger = require('../../../src/middleware/requestLogger');

describe('requestLogger middleware', () => {
  let req;
  let res;
  let next;
  let consoleLogSpy;
  let mockConfig;

  beforeEach(() => {
    req = {
      method: 'GET',
      path: '/test',
      headers: { authorization: 'Bearer secret' },
      body: { data: 'test' },
      query: { param: 'value' },
    };
    res = {};
    next = jest.fn();
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  describe('when logRequests is false', () => {
    it('should log only basic request info', () => {
      mockConfig = { logRequests: false };
      const middleware = requestLogger(mockConfig);

      middleware(req, res, next);

      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('GET /test'));
      expect(next).toHaveBeenCalled();
    });
  });

  describe('when logRequests is true', () => {
    it('should log detailed request information', () => {
      mockConfig = { logRequests: true };
      const middleware = requestLogger(mockConfig);

      middleware(req, res, next);

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('GET /test'));
      expect(consoleLogSpy).toHaveBeenCalledWith('--- Incoming Request ---');
      expect(consoleLogSpy).toHaveBeenCalledWith('Headers:', expect.any(Object));
      expect(consoleLogSpy).toHaveBeenCalledWith('Body:', expect.any(Object));
      expect(consoleLogSpy).toHaveBeenCalledWith('Query:', expect.any(Object));
      expect(consoleLogSpy).toHaveBeenCalledWith('------------------------');
      expect(next).toHaveBeenCalled();
    });
  });
});
