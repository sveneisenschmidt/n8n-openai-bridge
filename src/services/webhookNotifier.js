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

const axios = require('axios');

/**
 * Webhook notification event types
 */
const WebhookEventType = {
  MODELS_CHANGED: 'models_changed',
  MODELS_LOADED: 'models_loaded',
};

/**
 * Service for notifying external webhooks when models change
 */
class WebhookNotifier {
  static EventType = WebhookEventType;
  constructor(config = {}) {
    this.webhookUrl = config.webhookUrl || null;
    this.timeout = config.timeout || 5000;
    this.maxRetries = config.maxRetries || 3;
    this.bearerToken = config.bearerToken || null;
    this.notifyOnStartup = config.notifyOnStartup || false;

    // Only enable if webhook URL is configured
    this.enabled = !!this.webhookUrl;
  }

  /**
   * Notify webhook about model changes
   * @param {Object} payload - Notification payload
   * @param {WebhookEventType} payload.type - Event type (WebhookNotifier.EventType.MODELS_CHANGED or .MODELS_LOADED)
   * @param {Object} payload.models - Updated models object
   * @param {string} payload.source - Source of the change (loader class name)
   * @param {string} payload.timestamp - ISO timestamp of the change
   * @returns {Promise<void>}
   */
  async notify(payload) {
    if (!this.enabled) {
      return;
    }

    const headers = {
      'Content-Type': 'application/json',
    };

    if (this.bearerToken) {
      headers['Authorization'] = `Bearer ${this.bearerToken}`;
    }

    let lastError = null;

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        await axios.post(this.webhookUrl, payload, {
          headers,
          timeout: this.timeout,
        });

        // Success - log and return
        console.log(`[${new Date().toISOString()}] Webhook notified: ${this.webhookUrl}`);
        return;
      } catch (error) {
        lastError = error;
        const isLastAttempt = attempt === this.maxRetries - 1;

        if (isLastAttempt) {
          console.error(
            `[${new Date().toISOString()}] Webhook notification failed after ${this.maxRetries} attempts: ${error.message}`,
          );
        } else {
          // Exponential backoff: 1s, 2s, 4s
          const backoffMs = Math.pow(2, attempt) * 1000;
          console.warn(
            `[${new Date().toISOString()}] Webhook notification failed (attempt ${attempt + 1}/${this.maxRetries}), retrying in ${backoffMs}ms: ${error.message}`,
          );
          await this.sleep(backoffMs);
        }
      }
    }

    // All retries failed - log but don't throw (graceful degradation)
    if (lastError) {
      console.error(
        `[${new Date().toISOString()}] Webhook notification permanently failed: ${lastError.message}`,
      );
    }
  }

  /**
   * Sleep helper for retry backoff
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise<void>}
   * @private
   */
  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Create payload for model change notification
   * @param {Object} models - Models object
   * @param {string} source - Source loader class name
   * @param {WebhookEventType} eventType - Event type (use WebhookNotifier.EventType enum, required)
   * @returns {Object} Notification payload
   */
  static createPayload(models, source, eventType) {
    if (!eventType) {
      throw new Error(
        'eventType is required. Use WebhookNotifier.EventType.MODELS_CHANGED or .MODELS_LOADED',
      );
    }

    return {
      type: eventType,
      timestamp: new Date().toISOString(),
      source,
      models,
      modelCount: Object.keys(models).length,
    };
  }
}

module.exports = WebhookNotifier;
