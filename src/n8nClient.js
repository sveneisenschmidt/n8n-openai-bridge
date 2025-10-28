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

class N8nClient {
  constructor(config, taskDetectorService = null) {
    this.config = config;
    this.taskDetectorService = taskDetectorService;
    this.MAX_BUFFER_SIZE = 10 * 1024 * 1024; // 10MB max buffer size
  }

  getHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    if (this.config.n8nWebhookBearerToken) {
      headers['Authorization'] = `Bearer ${this.config.n8nWebhookBearerToken}`;
    }
    return headers;
  }

  buildPayload(messages, sessionId, userContext) {
    const systemPrompt = messages.find((m) => m.role === 'system')?.content || '';
    const currentMessage = messages[messages.length - 1]?.content || '';

    const payload = {
      systemPrompt,
      currentMessage,
      chatInput: currentMessage,
      messages: messages.filter((m) => m.role !== 'system'),
      sessionId,
      userId: userContext.userId,
      isTask: false,
      taskType: null,
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

    // Add task detection if enabled
    if (this.config.enableTaskDetection && this.taskDetectorService) {
      const taskDetection = this.taskDetectorService.detectTask(messages);
      if (taskDetection.isTask) {
        payload.isTask = true;
        payload.taskType = taskDetection.taskType;
      }
    }

    return payload;
  }

  /**
   * Process response stream and extract JSON chunks
   * Shared method to eliminate duplication between streaming and non-streaming
   * @private
   */
  async *processResponseStream(response) {
    let buffer = '';

    for await (const chunk of response.data) {
      const text = chunk.toString();
      buffer += text;

      // Check buffer size to prevent memory exhaustion
      if (buffer.length > this.MAX_BUFFER_SIZE) {
        throw new Error(`Response buffer exceeded maximum size of ${this.MAX_BUFFER_SIZE} bytes`);
      }

      // Process JSON chunks
      if (buffer.includes('{') && buffer.includes('}')) {
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
  }

  async *streamCompletion(webhookUrl, messages, sessionId, userContext) {
    const payload = this.buildPayload(messages, sessionId, userContext);

    try {
      const response = await axios.post(webhookUrl, payload, {
        headers: this.getHeaders(),
        responseType: 'stream',
        timeout: 300000, // 5 minutes
      });

      // Use the shared stream processing method
      yield* this.processResponseStream(response);
    } catch (error) {
      console.error('Streaming error:', error.message);
      throw error;
    }
  }

  async nonStreamingCompletion(webhookUrl, messages, sessionId, userContext) {
    const payload = this.buildPayload(messages, sessionId, userContext);

    try {
      // n8n always sends streams, so we need to handle it as a stream
      // and collect all content chunks
      const response = await axios.post(webhookUrl, payload, {
        headers: this.getHeaders(),
        responseType: 'stream',
        timeout: 300000, // 5 minutes
      });

      const collectedContent = [];

      // Use the shared stream processing method
      for await (const content of this.processResponseStream(response)) {
        collectedContent.push(content);
      }

      // Return all collected content as a single string
      return collectedContent.join('');
    } catch (error) {
      console.error('Non-streaming error:', error.message);
      throw error;
    }
  }

  extractJsonChunks(buffer) {
    const extracted = [];
    let remainder = buffer;

    while (true) {
      const startIdx = remainder.indexOf('{');
      if (startIdx === -1) {
        break;
      }

      let braceCount = 0;
      let endIdx = -1;

      for (let i = startIdx; i < remainder.length; i++) {
        if (remainder[i] === '{') {
          braceCount++;
        } else if (remainder[i] === '}') {
          braceCount--;
          if (braceCount === 0) {
            endIdx = i;
            break;
          }
        }
      }

      if (endIdx === -1) {
        break;
      }

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
      if (data.type && ['begin', 'end', 'error', 'metadata'].includes(data.type)) {
        return null;
      }

      // Extract content from common fields
      return data.content || data.text || data.output || data.message || null;
    } catch {
      // Not JSON, return as plain text
      const stripped = chunkText.trim();
      return stripped.startsWith('{') ? null : stripped;
    }
  }
}

module.exports = N8nClient;
