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
const FormData = require('form-data');
const { StringDecoder } = require('string_decoder');
const {
  processMessages,
  filesToBuffers,
  extractTextFromMultimodal,
  isMultimodalMessage,
} = require('./utils/fileProcessor');

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
    const fileUploadMode = this.config.fileUploadMode || 'passthrough';

    // Process messages according to file upload mode
    const { messages: processedMessages, files } = processMessages(messages, fileUploadMode);

    // Extract system prompt (handle multimodal content)
    const systemMessage = processedMessages.find((m) => m.role === 'system');
    const systemPrompt = systemMessage
      ? isMultimodalMessage(systemMessage)
        ? extractTextFromMultimodal(systemMessage)
        : systemMessage.content || ''
      : '';

    // Extract current message (handle multimodal content)
    const lastMessage = processedMessages[processedMessages.length - 1];
    const currentMessage = lastMessage
      ? isMultimodalMessage(lastMessage)
        ? extractTextFromMultimodal(lastMessage)
        : lastMessage.content || ''
      : '';

    const payload = {
      systemPrompt,
      currentMessage,
      chatInput: currentMessage,
      messages: processedMessages.filter((m) => m.role !== 'system'),
      sessionId,
      userId: userContext.userId,
      isTask: false,
      taskType: null,
    };

    // Add files array for extract-json mode
    if (fileUploadMode === 'extract-json' && files.length > 0) {
      payload.files = files;
    }

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

    // Store files for multipart mode (used by request methods)
    this._pendingFiles = fileUploadMode === 'extract-multipart' ? files : [];

    return payload;
  }

  /**
   * Process response stream and extract JSON chunks
   * Shared method to eliminate duplication between streaming and non-streaming
   * @private
   */
  async *processResponseStream(response) {
    let buffer = '';
    const decoder = new StringDecoder('utf8');
    let hasYieldedContent = false;
    let pendingTurnSeparator = false;

    for await (const chunk of response.data) {
      const text = decoder.write(chunk);
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
          // Track agent turn boundaries to inject separators
          if (this.isAgentTurnEnd(jsonChunk)) {
            if (hasYieldedContent) {
              pendingTurnSeparator = true;
            }
          }

          const content = this.parseN8nChunk(jsonChunk);
          if (content) {
            if (pendingTurnSeparator) {
              yield '\n\n';
              pendingTurnSeparator = false;
            }
            hasYieldedContent = true;
            yield content;
          }
        }
      }
    }

    // Flush any remaining buffered UTF-8 bytes
    buffer += decoder.end();

    // Process remaining buffer
    if (buffer.trim()) {
      const content = this.parseN8nChunk(buffer.trim());
      if (content) {
        if (pendingTurnSeparator) {
          yield '\n\n';
        }
        yield content;
      }
    }
  }

  /**
   * Build request config for axios, handling multipart mode
   * @param {Object} payload - JSON payload
   * @param {Array} files - Files to upload (for multipart mode)
   * @returns {Object} Axios request config
   * @private
   */
  buildRequestConfig(payload, files) {
    if (files && files.length > 0) {
      // Multipart mode - send payload fields directly for n8n compatibility
      const form = new FormData();

      // Add all payload fields as form fields
      for (const [key, value] of Object.entries(payload)) {
        if (value !== null && value !== undefined) {
          // Stringify objects/arrays, keep primitives as-is
          const formValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
          form.append(key, formValue);
        }
      }

      // Add files as binary
      const bufferFiles = filesToBuffers(files);
      for (const file of bufferFiles) {
        form.append('files', file.buffer, {
          filename: file.name,
          contentType: file.mimeType,
        });
      }

      return {
        headers: {
          ...form.getHeaders(),
          ...(this.config.n8nWebhookBearerToken && {
            Authorization: `Bearer ${this.config.n8nWebhookBearerToken}`,
          }),
        },
        data: form,
        responseType: 'stream',
        timeout: this.config.n8nTimeout,
      };
    }

    // JSON mode
    return {
      headers: this.getHeaders(),
      data: payload,
      responseType: 'stream',
      timeout: this.config.n8nTimeout,
    };
  }

  async *streamCompletion(webhookUrl, messages, sessionId, userContext) {
    const payload = this.buildPayload(messages, sessionId, userContext);
    const files = this._pendingFiles || [];
    this._pendingFiles = [];

    try {
      const config = this.buildRequestConfig(payload, files);
      const response = await axios.post(webhookUrl, config.data, {
        headers: config.headers,
        responseType: config.responseType,
        timeout: config.timeout,
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
    const files = this._pendingFiles || [];
    this._pendingFiles = [];

    try {
      // n8n always sends streams, so we need to handle it as a stream
      // and collect all content chunks
      const config = this.buildRequestConfig(payload, files);
      const response = await axios.post(webhookUrl, config.data, {
        headers: config.headers,
        responseType: config.responseType,
        timeout: config.timeout,
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
      let inString = false;
      let escapeNext = false;

      for (let i = startIdx; i < remainder.length; i++) {
        const char = remainder[i];

        if (escapeNext) {
          escapeNext = false;
          continue;
        }

        if (char === '\\' && inString) {
          escapeNext = true;
          continue;
        }

        if (char === '"') {
          inString = !inString;
          continue;
        }

        // Only count braces outside of strings
        if (!inString) {
          if (char === '{') {
            braceCount++;
          } else if (char === '}') {
            braceCount--;
            if (braceCount === 0) {
              endIdx = i;
              break;
            }
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

  /**
   * Check if a JSON chunk represents an agent turn boundary (end marker).
   * n8n AI Agent sends {"type":"end"} when a turn completes (e.g. before tool execution).
   * Used to inject separators between agent turns in streaming responses.
   * @param {string} chunkText - Raw JSON string
   * @returns {boolean} True if this is an end-of-turn marker
   */
  isAgentTurnEnd(chunkText) {
    try {
      const data = JSON.parse(chunkText);
      return data.type === 'end';
    } catch {
      return false;
    }
  }
}

module.exports = N8nClient;
