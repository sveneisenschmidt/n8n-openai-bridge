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

const {
  createStreamingChunk,
  createCompletionResponse,
  createStatus,
  createStatusToolCallChunks,
  createTypeStatusChunk,
} = require('../../src/utils/openaiResponse');

describe('openaiResponse utility', () => {
  describe('createStreamingChunk', () => {
    it('should create streaming chunk with content', () => {
      const chunk = createStreamingChunk('gpt-4', 'Hello world', null);

      expect(chunk).toMatchObject({
        object: 'chat.completion.chunk',
        model: 'gpt-4',
        choices: [
          {
            index: 0,
            delta: { content: 'Hello world' },
            finish_reason: null,
          },
        ],
      });
      expect(chunk.id).toMatch(/^chatcmpl-/);
      expect(chunk.created).toBeGreaterThan(0);
    });

    it('should create streaming chunk with finish reason', () => {
      const chunk = createStreamingChunk('gpt-4', null, 'stop');

      expect(chunk).toMatchObject({
        object: 'chat.completion.chunk',
        model: 'gpt-4',
        choices: [
          {
            index: 0,
            delta: {},
            finish_reason: 'stop',
          },
        ],
      });
    });

    it('should create streaming chunk with both content and finish reason', () => {
      const chunk = createStreamingChunk('gpt-4', 'Final message', 'stop');

      expect(chunk).toMatchObject({
        object: 'chat.completion.chunk',
        model: 'gpt-4',
        choices: [
          {
            index: 0,
            delta: { content: 'Final message' },
            finish_reason: 'stop',
          },
        ],
      });
    });
  });

  describe('createCompletionResponse', () => {
    it('should create non-streaming completion response', () => {
      const response = createCompletionResponse('gpt-4', 'Hello world');

      expect(response).toMatchObject({
        object: 'chat.completion',
        model: 'gpt-4',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'Hello world',
            },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 0,
          completion_tokens: 0,
          total_tokens: 0,
        },
      });
      expect(response.id).toMatch(/^chatcmpl-/);
      expect(response.created).toBeGreaterThan(0);
    });
  });

  describe('createStatus', () => {
    it('should create status object with message and done flag', () => {
      const status = createStatus('Processing', false);

      expect(status).toEqual({
        message: 'Processing',
        done: false,
      });
    });

    it('should default done to false', () => {
      const status = createStatus('Starting');

      expect(status.done).toBe(false);
    });
  });

  describe('createStatusToolCallChunks', () => {
    it('should create array of status tool call chunks', () => {
      const status = createStatus('Processing', false);
      const chunks = createStatusToolCallChunks('gpt-4', status);

      expect(Array.isArray(chunks)).toBe(true);
      expect(chunks).toHaveLength(2);
    });

    it('should have first chunk with id, type, name, and empty arguments', () => {
      const status = createStatus('Processing', false);
      const chunks = createStatusToolCallChunks('gpt-4', status);
      const firstChunk = chunks[0];

      expect(firstChunk).toMatchObject({
        object: 'chat.completion.chunk',
        model: 'gpt-4',
        choices: [
          {
            index: 0,
            delta: {
              tool_calls: [
                {
                  index: 0,
                  type: 'function',
                  function: {
                    name: 'emit_status',
                    arguments: '',
                  },
                },
              ],
            },
            finish_reason: null,
          },
        ],
      });
      expect(firstChunk.id).toMatch(/^chatcmpl-/);
      expect(firstChunk.created).toBeGreaterThan(0);
      expect(firstChunk.choices[0].delta.tool_calls[0].id).toMatch(/^call_status_/);
    });

    it('should have second chunk with arguments only', () => {
      const status = createStatus('Processing', false);
      const chunks = createStatusToolCallChunks('gpt-4', status);
      const secondChunk = chunks[1];

      expect(secondChunk).toMatchObject({
        object: 'chat.completion.chunk',
        model: 'gpt-4',
        choices: [
          {
            index: 0,
            delta: {
              tool_calls: [
                {
                  index: 0,
                  function: {
                    arguments: JSON.stringify({ message: 'Processing' }),
                  },
                },
              ],
            },
            finish_reason: null,
          },
        ],
      });
      expect(secondChunk.id).toMatch(/^chatcmpl-/);
      expect(secondChunk.created).toBeGreaterThan(0);
    });

    it('should use same chat ID and timestamp for both chunks', () => {
      const status = createStatus('Test', false);
      const chunks = createStatusToolCallChunks('gpt-4', status);

      expect(chunks[0].id).toBe(chunks[1].id);
      expect(chunks[0].created).toBe(chunks[1].created);
    });

    it('should create chunks for completed status', () => {
      const status = createStatus('Completed', true);
      const chunks = createStatusToolCallChunks('test-model', status);

      expect(chunks[1].choices[0].delta.tool_calls[0].function.arguments).toBe(
        JSON.stringify({ message: 'Completed' }),
      );
    });

    it('should have call ID with correct format', () => {
      const status = createStatus('Step 1', false);
      const chunks = createStatusToolCallChunks('gpt-4', status);

      const id = chunks[0].choices[0].delta.tool_calls[0].id;

      expect(id).toMatch(/^call_status_\d+$/);
    });
  });

  describe('createTypeStatusChunk', () => {
    it('should create type_status chunk with info status when not done', () => {
      const status = createStatus('Processing', false);
      const chunk = createTypeStatusChunk('gpt-4', status);

      expect(chunk).toEqual({
        type: 'status',
        data: {
          status: 'info',
          description: 'Processing',
          done: false,
        },
      });
    });

    it('should create type_status chunk with complete status when done', () => {
      const status = createStatus('Completed', true);
      const chunk = createTypeStatusChunk('gpt-4', status);

      expect(chunk).toEqual({
        type: 'status',
        data: {
          status: 'complete',
          description: 'Completed',
          done: true,
        },
      });
    });

    it('should default to done=false when not specified', () => {
      const status = createStatus('Starting');
      const chunk = createTypeStatusChunk('gpt-4', status);

      expect(chunk.data.done).toBe(false);
      expect(chunk.data.status).toBe('info');
    });
  });
});
