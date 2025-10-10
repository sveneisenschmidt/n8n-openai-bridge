const axios = require('axios');
const config = require('./config');

class N8nClient {
  constructor() {
    this.config = config;
  }

  getHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    if (this.config.n8nBearerToken) {
      headers['Authorization'] = `Bearer ${this.config.n8nBearerToken}`;
    }
    return headers;
  }

  buildPayload(messages, sessionId, userId) {
    const systemPrompt = messages.find(m => m.role === 'system')?.content || '';
    const currentMessage = messages[messages.length - 1]?.content || '';
    
    return {
      systemPrompt,
      currentMessage,
      chatInput: currentMessage,
      messages: messages.filter(m => m.role !== 'system'),
      sessionId,
      userId,
    };
  }

  async *streamCompletion(webhookUrl, messages, sessionId, userId) {
    const payload = this.buildPayload(messages, sessionId, userId);
    
    try {
      const response = await axios.post(webhookUrl, payload, {
        headers: this.getHeaders(),
        responseType: 'stream',
        timeout: 300000, // 5 minutes
      });

      let buffer = '';
      
      for await (const chunk of response.data) {
        const text = chunk.toString();
        buffer += text;

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
    } catch (error) {
      console.error('Streaming error:', error.message);
      throw error;
    }
  }

  async nonStreamingCompletion(webhookUrl, messages, sessionId, userId) {
    const payload = this.buildPayload(messages, sessionId, userId);

    try {
      // n8n always sends streams, so we need to handle it as a stream
      // and collect all content chunks
      const response = await axios.post(webhookUrl, payload, {
        headers: this.getHeaders(),
        responseType: 'stream',
        timeout: 300000, // 5 minutes
      });

      let buffer = '';
      let collectedContent = [];

      for await (const chunk of response.data) {
        const text = chunk.toString();
        buffer += text;

        // Process JSON chunks
        if (buffer.includes('{') && buffer.includes('}')) {
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
      if (startIdx === -1) break;

      let braceCount = 0;
      let endIdx = -1;

      for (let i = startIdx; i < remainder.length; i++) {
        if (remainder[i] === '{') braceCount++;
        else if (remainder[i] === '}') {
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

module.exports = new N8nClient();
