/**
 * Tests for messageConsolidator utility
 *
 * Copyright (c) 2025 Sven Eisenschmidt
 * Licensed under AGPL-3.0
 */

const { consolidateMessages } = require('../../src/utils/messageConsolidator');

describe('messageConsolidator', () => {
  describe('single message', () => {
    test('should return content as-is for single user message', () => {
      const messages = [{ role: 'user', content: 'Hello' }];
      const result = consolidateMessages(messages);
      expect(result).toBe('Hello');
    });

    test('should return content as-is for single assistant message', () => {
      const messages = [{ role: 'assistant', content: 'Hi there!' }];
      const result = consolidateMessages(messages);
      expect(result).toBe('Hi there!');
    });

    test('should handle empty content in single message', () => {
      const messages = [{ role: 'user', content: '' }];
      const result = consolidateMessages(messages);
      expect(result).toBe('');
    });

    test('should handle missing content in single message', () => {
      const messages = [{ role: 'user' }];
      const result = consolidateMessages(messages);
      expect(result).toBe('');
    });
  });

  describe('multiple messages', () => {
    test('should wrap messages with XML-like tags', () => {
      const messages = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' },
        { role: 'user', content: 'How are you?' },
      ];
      const result = consolidateMessages(messages);
      expect(result).toBe(
        '<user>Hello</user><assistant>Hi there!</assistant><user>How are you?</user>',
      );
    });

    test('should handle user and assistant roles', () => {
      const messages = [
        { role: 'user', content: 'What is 2+2?' },
        { role: 'assistant', content: '4' },
      ];
      const result = consolidateMessages(messages);
      expect(result).toBe('<user>What is 2+2?</user><assistant>4</assistant>');
    });

    test('should handle tool role', () => {
      const messages = [
        { role: 'user', content: 'Check the weather' },
        { role: 'tool', content: 'Sunny, 72F' },
      ];
      const result = consolidateMessages(messages);
      expect(result).toBe('<user>Check the weather</user><tool>Sunny, 72F</tool>');
    });

    test('should handle function role', () => {
      const messages = [
        { role: 'user', content: 'Call API' },
        { role: 'function', content: '{"status": "ok"}' },
      ];
      const result = consolidateMessages(messages);
      expect(result).toBe('<user>Call API</user><function>{"status": "ok"}</function>');
    });

    test('should handle unknown roles by using role name as tag', () => {
      const messages = [
        { role: 'user', content: 'Hello' },
        { role: 'custom', content: 'Custom response' },
      ];
      const result = consolidateMessages(messages);
      expect(result).toBe('<user>Hello</user><custom>Custom response</custom>');
    });

    test('should handle missing role by using "unknown"', () => {
      const messages = [{ role: 'user', content: 'Hello' }, { content: 'No role' }];
      const result = consolidateMessages(messages);
      expect(result).toBe('<user>Hello</user><unknown>No role</unknown>');
    });

    test('should handle empty content in messages', () => {
      const messages = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: '' },
        { role: 'user', content: 'How are you?' },
      ];
      const result = consolidateMessages(messages);
      expect(result).toBe('<user>Hello</user><assistant></assistant><user>How are you?</user>');
    });
  });

  describe('multimodal content', () => {
    test('should extract text from multimodal message', () => {
      const messages = [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'What is in this image?' },
            {
              type: 'image_url',
              image_url: { url: 'data:image/png;base64,abc123' },
            },
          ],
        },
        { role: 'assistant', content: 'It is a cat.' },
      ];
      const result = consolidateMessages(messages);
      expect(result).toBe('<user>What is in this image?</user><assistant>It is a cat.</assistant>');
    });

    test('should handle multiple text parts in multimodal message', () => {
      const messages = [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'First part' },
            { type: 'text', text: 'Second part' },
          ],
        },
      ];
      const result = consolidateMessages(messages);
      expect(result).toBe('First part\nSecond part');
    });

    test('should handle multimodal with no text parts', () => {
      const messages = [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: 'data:image/png;base64,abc123' },
            },
          ],
        },
        { role: 'assistant', content: 'I see an image.' },
      ];
      const result = consolidateMessages(messages);
      expect(result).toBe('<user></user><assistant>I see an image.</assistant>');
    });
  });

  describe('edge cases', () => {
    test('should return empty string for empty array', () => {
      const result = consolidateMessages([]);
      expect(result).toBe('');
    });

    test('should return empty string for null', () => {
      const result = consolidateMessages(null);
      expect(result).toBe('');
    });

    test('should return empty string for undefined', () => {
      const result = consolidateMessages(undefined);
      expect(result).toBe('');
    });

    test('should handle special characters in content', () => {
      const messages = [
        { role: 'user', content: 'Test with \n newlines \t tabs and "quotes"' },
        { role: 'assistant', content: 'Response with <xml> tags' },
      ];
      const result = consolidateMessages(messages);
      expect(result).toContain('\n');
      expect(result).toContain('\t');
      expect(result).toContain('"');
      expect(result).toContain('<xml>');
    });

    test('should handle very long content', () => {
      const longContent = 'A'.repeat(10000);
      const messages = [
        { role: 'user', content: longContent },
        { role: 'assistant', content: 'OK' },
      ];
      const result = consolidateMessages(messages);
      expect(result).toBe(`<user>${longContent}</user><assistant>OK</assistant>`);
      // 10000 (longContent) + 2 (OK) + 36 (tags: <user></user><assistant></assistant>)
      expect(result.length).toBe(10038);
    });
  });
});