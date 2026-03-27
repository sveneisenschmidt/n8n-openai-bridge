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

const WebhookNotifierService = require('../services/webhookNotifierService');

/**
 * WebhookNotifierFactory - Factory for creating WebhookNotifierService instances
 *
 * Responsibilities:
 * - Create and configure WebhookNotifierService instances
 * - Read webhook-related environment variables
 *
 * Does NOT:
 * - Manage model state (see ModelRepository)
 * - Parse server configuration (see Config)
 * - Orchestrate lifecycle (see Bootstrap)
 */
class WebhookNotifierFactory {
  /**
   * Create and configure the WebhookNotifierService
   * Only enabled if WEBHOOK_NOTIFIER_URL is set
   * @returns {WebhookNotifierService} Configured notifier instance
   */
  static createWebhookNotifier() {
    const config = {
      webhookUrl: process.env.WEBHOOK_NOTIFIER_URL || null,
      timeout: parseInt(process.env.WEBHOOK_NOTIFIER_TIMEOUT || '5000', 10),
      maxRetries: parseInt(process.env.WEBHOOK_NOTIFIER_RETRIES || '3', 10),
      bearerToken: process.env.WEBHOOK_NOTIFIER_BEARER_TOKEN || null,
      notifyOnStartup: process.env.WEBHOOK_NOTIFIER_ON_STARTUP === 'true',
    };

    return new WebhookNotifierService(config);
  }
}

module.exports = WebhookNotifierFactory;
