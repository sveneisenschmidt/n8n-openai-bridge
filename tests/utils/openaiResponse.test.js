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
  createStatusToolCallChunk,
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

  describe('createStatusToolCallChunk', () => {
    it('should create status tool call chunk with all fields', () => {
      const statusData = {
        message: 'Processing',
        progress: 50,
        step: 'processing',
      };

      const chunk = createStatusToolCallChunk('gpt-4', statusData);

      expect(chunk).toMatchObject({
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
                    arguments: JSON.stringify(statusData),
                  },
                },
              ],
            },
            finish_reason: null,
          },
        ],
      });
      expect(chunk.id).toMatch(/^chatcmpl-/);
      expect(chunk.created).toBeGreaterThan(0);
      expect(chunk.choices[0].delta.tool_calls[0].id).toMatch(/^call_status_/);
    });

    it('should create status tool call chunk for initiating step', () => {
      const statusData = {
        message: 'Initiating',
        progress: 10,
        step: 'initiating',
      };

      const chunk = createStatusToolCallChunk('test-model', statusData);

      expect(chunk.choices[0].delta.tool_calls[0].function.arguments).toBe(
        JSON.stringify(statusData),
      );
    });

    it('should create status tool call chunk for completed step', () => {
      const statusData = {
        message: 'Completed',
        progress: 100,
        step: 'completed',
      };

      const chunk = createStatusToolCallChunk('test-model', statusData);

      expect(chunk.choices[0].delta.tool_calls[0].function.arguments).toBe(
        JSON.stringify(statusData),
      );
    });

    it('should have call ID with correct format', () => {
      const chunk = createStatusToolCallChunk('gpt-4', {
        message: 'Step 1',
        progress: 25,
        step: 'step1',
      });

      const id = chunk.choices[0].delta.tool_calls[0].id;

      expect(id).toMatch(/^call_status_\d+$/);
    });
  });

  describe('createTypeStatusChunk', () => {
    it('should create type_status chunk with info status when not done', () => {
      const statusData = {
        message: 'Processing',
        progress: 50,
        step: 'processing',
      };

      const chunk = createTypeStatusChunk('gpt-4', statusData, false);

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
      const statusData = {
        message: 'Completed',
        progress: 100,
        step: 'completed',
      };

      const chunk = createTypeStatusChunk('gpt-4', statusData, true);

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
      const statusData = {
        message: 'Starting',
        progress: 0,
        step: 'starting',
      };

      const chunk = createTypeStatusChunk('gpt-4', statusData);

      expect(chunk.data.done).toBe(false);
      expect(chunk.data.status).toBe('info');
    });
  });
});
