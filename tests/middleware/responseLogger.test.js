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

const responseLogger = require('../../src/middleware/responseLogger');

describe('responseLogger middleware', () => {
  let consoleLogSpy;
  let req;
  let res;
  let next;

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

    req = {};
    res = {
      write: jest.fn(),
      json: jest.fn(),
    };
    next = jest.fn();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  describe('when LOG_RESPONSES is false', () => {
    it('should not wrap response methods', () => {
      const config = { logResponses: false };
      const middleware = responseLogger(config);

      const originalWrite = res.write;
      const originalJson = res.json;

      middleware(req, res, next);

      expect(res.write).toBe(originalWrite);
      expect(res.json).toBe(originalJson);
      expect(next).toHaveBeenCalled();
    });

    it('should not log responses', () => {
      const config = { logResponses: false };
      const middleware = responseLogger(config);

      middleware(req, res, next);
      res.write('test data');
      res.json({ test: 'data' });

      expect(consoleLogSpy).not.toHaveBeenCalled();
    });
  });

  describe('when LOG_RESPONSES is true', () => {
    it('should wrap res.write and log data', () => {
      const config = { logResponses: true };
      const middleware = responseLogger(config);

      const originalWrite = res.write;
      middleware(req, res, next);

      const testData = 'data: {"test":"value"}';
      res.write(testData);

      expect(consoleLogSpy).toHaveBeenCalledWith(testData);
      expect(originalWrite).toHaveBeenCalled();
    });

    it('should wrap res.json and log data', () => {
      const config = { logResponses: true };
      const middleware = responseLogger(config);

      const originalJson = res.json;
      middleware(req, res, next);

      const testData = { test: 'value', status: 'ok' };
      res.json(testData);

      expect(consoleLogSpy).toHaveBeenCalledWith(JSON.stringify(testData));
      expect(originalJson).toHaveBeenCalled();
    });

    it('should trim whitespace from logged data', () => {
      const config = { logResponses: true };
      const middleware = responseLogger(config);

      middleware(req, res, next);

      const testData = '  data: test  \n\n';
      res.write(testData);

      expect(consoleLogSpy).toHaveBeenCalledWith('data: test');
    });

    it('should not log empty chunks', () => {
      const config = { logResponses: true };
      const middleware = responseLogger(config);

      middleware(req, res, next);

      res.write('');
      res.write('   ');

      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it('should log multiple write calls', () => {
      const config = { logResponses: true };
      const middleware = responseLogger(config);

      middleware(req, res, next);

      res.write('chunk1');
      res.write('chunk2');
      res.write('chunk3');

      expect(consoleLogSpy).toHaveBeenCalledTimes(3);
      expect(consoleLogSpy).toHaveBeenNthCalledWith(1, 'chunk1');
      expect(consoleLogSpy).toHaveBeenNthCalledWith(2, 'chunk2');
      expect(consoleLogSpy).toHaveBeenNthCalledWith(3, 'chunk3');
    });

    it('should handle Buffer chunks', () => {
      const config = { logResponses: true };
      const middleware = responseLogger(config);

      middleware(req, res, next);

      const buffer = Buffer.from('test buffer data');
      res.write(buffer);

      expect(consoleLogSpy).toHaveBeenCalledWith('test buffer data');
    });

    it('should call next() to continue middleware chain', () => {
      const config = { logResponses: true };
      const middleware = responseLogger(config);

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });
});
