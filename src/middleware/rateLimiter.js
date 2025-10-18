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

const rateLimit = require('express-rate-limit');
const { createErrorResponse } = require('../utils/errorResponse');

/**
 * Create rate limiter middleware with configurable options
 *
 * @param {Object} config - Configuration object
 * @returns {Object} Rate limiter configurations for different endpoints
 */
function createRateLimiters(config) {
  // Get rate limit settings from environment or use defaults
  const rateLimitWindow = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000'); // 1 minute default
  const rateLimitMax = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'); // 100 requests default
  const rateLimitChatCompletions = parseInt(process.env.RATE_LIMIT_CHAT_COMPLETIONS || '30'); // 30 chat requests

  // Standard rate limiter for general endpoints
  const standardLimiter = rateLimit({
    windowMs: rateLimitWindow,
    max: rateLimitMax,
    message: 'Too many requests from this IP, please try again later',
    standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    handler: (req, res) => {
      if (config.logRequests && req.id) {
        console.log(`[${req.id}] Rate limit exceeded for IP: ${req.ip}`);
      }
      res.status(429).json(
        createErrorResponse('Too many requests, please try again later', 'rate_limit_error')
      );
    },
    skip: (req) => {
      // Skip rate limiting if disabled via environment
      return process.env.DISABLE_RATE_LIMIT === 'true';
    }
  });

  // Stricter rate limiter for chat completions endpoint
  const chatCompletionsLimiter = rateLimit({
    windowMs: rateLimitWindow,
    max: rateLimitChatCompletions,
    message: 'Too many chat completion requests from this IP',
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      if (config.logRequests && req.id) {
        console.log(`[${req.id}] Chat completions rate limit exceeded for IP: ${req.ip}`);
      }
      res.status(429).json(
        createErrorResponse('Too many chat completion requests, please try again later', 'rate_limit_error')
      );
    },
    skip: (req) => {
      return process.env.DISABLE_RATE_LIMIT === 'true';
    }
  });

  // Very permissive rate limiter for health check
  const healthCheckLimiter = rateLimit({
    windowMs: rateLimitWindow,
    max: rateLimitMax * 10, // 10x the standard limit for health checks
    standardHeaders: false,
    legacyHeaders: false,
    skip: (req) => {
      return process.env.DISABLE_RATE_LIMIT === 'true';
    }
  });

  return {
    standard: standardLimiter,
    chatCompletions: chatCompletionsLimiter,
    health: healthCheckLimiter
  };
}

module.exports = createRateLimiters;
