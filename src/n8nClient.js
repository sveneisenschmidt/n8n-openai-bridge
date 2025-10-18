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

const axios = require("axios");

class N8nClient {
  constructor(config) {
    this.config = config;
  }

  getWebhookHeaders() {
    const headers = { "Content-Type": "application/json" };
    if (this.config.n8nWebhookBearerToken) {
      headers["Authorization"] = `Bearer ${this.config.n8nWebhookBearerToken}`;
    }
    return headers;
  }

  getApiHeaders() {
    const headers = { "Content-Type": "application/json" };
    if (this.config.n8nApiBearerToken) {
      headers["Authorization"] = `Bearer ${this.config.n8nApiBearerToken}`;
    }
    return headers;
  }

  buildPayload(messages, sessionId, userContext) {
    const systemPrompt =
      messages.find((m) => m.role === "system")?.content || "";
    const currentMessage = messages[messages.length - 1]?.content || "";

    const payload = {
      systemPrompt,
      currentMessage,
      chatInput: currentMessage,
      messages: messages.filter((m) => m.role !== "system"),
      sessionId,
      userId: userContext.userId,
    };

    // Add optional user fields if provided
    if (userContext.userEmail) {
      payload.userEmail = userContext.userEmail;
    }
    if (userContext.userName) {
      payload.userName = userContext.userName;
    }
    if (userContext.userRole) {
      payload.userRole = userContext.userRole;
    }

    return payload;
  }

  async *streamCompletion(webhookUrl, messages, sessionId, userContext) {
    const payload = this.buildPayload(messages, sessionId, userContext);

    try {
      const response = await axios.post(webhookUrl, payload, {
        headers: this.getWebhookHeaders(),
        responseType: "stream",
        timeout: 300000, // 5 minutes
      });

      let buffer = "";

      for await (const chunk of response.data) {
        const text = chunk.toString();
        buffer += text;

        // Process JSON chunks
        if (buffer.includes("{") && buffer.includes("}")) {
          const chunks = this.extractJsonChunks(buffer);
          buffer = chunks.remainder;

          for (const jsonChunk of chunks.extracted) {
            const content = this.parseN8nChunk(jsonChunk);
            if (content) {
              yield content;
            }
          }
        }
      }

      // Process remaining buffer
      if (buffer.trim()) {
        const content = this.parseN8nChunk(buffer.trim());
        if (content) {
          yield content;
        }
      }
    } catch (error) {
      console.error("Streaming error:", error.message);
      throw error;
    }
  }

  async nonStreamingCompletion(webhookUrl, messages, sessionId, userContext) {
    const payload = this.buildPayload(messages, sessionId, userContext);

    try {
      // n8n always sends streams, so we need to handle it as a stream
      // and collect all content chunks
      const response = await axios.post(webhookUrl, payload, {
        headers: this.getWebhookHeaders(),
        responseType: "stream",
        timeout: 300000, // 5 minutes
      });

      let buffer = "";
      let collectedContent = [];

      for await (const chunk of response.data) {
        const text = chunk.toString();
        buffer += text;

        // Process JSON chunks
        if (buffer.includes("{") && buffer.includes("}")) {
          const chunks = this.extractJsonChunks(buffer);
          buffer = chunks.remainder;

          for (const jsonChunk of chunks.extracted) {
            const content = this.parseN8nChunk(jsonChunk);
            if (content) {
              collectedContent.push(content);
            }
          }
        }
      }

      // Process remaining buffer
      if (buffer.trim()) {
        const content = this.parseN8nChunk(buffer.trim());
        if (content) {
          collectedContent.push(content);
        }
      }

      // Return all collected content as a single string
      return collectedContent.join("");
    } catch (error) {
      console.error("Non-streaming error:", error.message);
      throw error;
    }
  }

  extractJsonChunks(buffer) {
    const extracted = [];
    let remainder = buffer;

    while (true) {
      const startIdx = remainder.indexOf("{");
      if (startIdx === -1) break;

      let braceCount = 0;
      let endIdx = -1;

      for (let i = startIdx; i < remainder.length; i++) {
        if (remainder[i] === "{") braceCount++;
        else if (remainder[i] === "}") {
          braceCount--;
          if (braceCount === 0) {
            endIdx = i;
            break;
          }
        }
      }

      if (endIdx === -1) break;

      extracted.push(remainder.substring(startIdx, endIdx + 1));
      remainder = remainder.substring(endIdx + 1);
    }

    return { extracted, remainder };
  }

  parseN8nChunk(chunkText) {
    if (!chunkText || !chunkText.trim()) {
      return null;
    }

    try {
      const data = JSON.parse(chunkText);

      // Skip metadata chunks
      if (
        data.type &&
        ["begin", "end", "error", "metadata"].includes(data.type)
      ) {
        return null;
      }

      // Extract content from common fields
      return data.content || data.text || data.output || data.message || null;
    } catch {
      // Not JSON, return as plain text
      const stripped = chunkText.trim();
      return stripped.startsWith("{") ? null : stripped;
    }
  }

  /**
   * Fetch workflows from n8n API with optional tag filter
   * @param {string} tag - Tag name to filter workflows (optional)
   * @returns {Promise<Array>} - Array of workflow objects
   */
  async getWorkflows(tag = null) {
    if (!this.config.n8nApiUrl) {
      throw new Error("N8N_API_URL not configured");
    }

    if (!this.config.n8nApiBearerToken) {
      throw new Error("N8N_API_BEARER_TOKEN not configured");
    }

    const baseUrl = this.config.n8nApiUrl.replace(/\/$/, ""); // Remove trailing slash
    let url = `${baseUrl}/api/v1/workflows?limit=250`;

    if (tag) {
      url += `&tags=${encodeURIComponent(tag)}`;
    }

    const allWorkflows = [];
    let cursor = null;

    try {
      do {
        const requestUrl = cursor ? `${url}&cursor=${cursor}` : url;

        const response = await axios.get(requestUrl, {
          headers: this.getApiHeaders(),
          timeout: 30000, // 30 seconds
        });

        if (response.data && response.data.data) {
          allWorkflows.push(...response.data.data);
          cursor = response.data.nextCursor || null;
        } else {
          break;
        }
      } while (cursor);

      return allWorkflows;
    } catch (error) {
      console.error("Error fetching workflows from n8n API:", error.message);
      throw error;
    }
  }

  /**
   * Extract webhook URL from workflow nodes
   * @param {object} workflow - Workflow object from n8n API
   * @returns {string|null} - Webhook URL or null if not found
   */
  extractWebhookUrl(workflow) {
    if (!workflow.nodes || !Array.isArray(workflow.nodes)) {
      return null;
    }

    // Find webhook node
    const webhookNode = workflow.nodes.find(
      (node) =>
        node.type === "n8n-nodes-base.webhook" || node.type.includes("webhook"),
    );

    if (!webhookNode) {
      return null;
    }

    // Use webhook base URL (may differ from API URL)
    const baseUrl = this.config.n8nWebhookBaseUrl.replace(/\/$/, "");

    // Try to get webhookId (preferred method)
    if (webhookNode.webhookId) {
      return `${baseUrl}/webhook/${webhookNode.webhookId}`;
    }

    // Fallback: Try to construct from parameters.path
    if (webhookNode.parameters && webhookNode.parameters.path) {
      const path = webhookNode.parameters.path;
      return `${baseUrl}/webhook/${path}`;
    }

    // Last resort: Use workflow ID
    if (workflow.id) {
      return `${baseUrl}/webhook/${workflow.id}`;
    }

    return null;
  }
}

module.exports = N8nClient;
