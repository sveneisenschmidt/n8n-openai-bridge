const createDetector = require('../../src/detectors/createDetector');

describe('createDetector', () => {
  describe('basic functionality', () => {
    test('should return a function', () => {
      const patternGroups = [[/test/i]];
      const detector = createDetector(patternGroups);

      expect(typeof detector).toBe('function');
    });

    test('should return false for empty messages array', () => {
      const patternGroups = [[/test/i]];
      const detector = createDetector(patternGroups);

      const result = detector([]);

      expect(result).toBe(false);
    });

    test('should return false for non-array input', () => {
      const patternGroups = [[/test/i]];
      const detector = createDetector(patternGroups);

      expect(detector(null)).toBe(false);
      expect(detector(undefined)).toBe(false);
      expect(detector('not-array')).toBe(false);
      expect(detector({})).toBe(false);
    });
  });

  describe('single pattern group', () => {
    test('should detect when single pattern matches', () => {
      const patternGroups = [[/generate.*title/i]];
      const detector = createDetector(patternGroups);

      const messages = [{ role: 'user', content: 'Generate a title for this' }];

      expect(detector(messages)).toBe(true);
    });

    test('should not detect when pattern does not match', () => {
      const patternGroups = [[/generate.*title/i]];
      const detector = createDetector(patternGroups);

      const messages = [{ role: 'user', content: 'Hello world' }];

      expect(detector(messages)).toBe(false);
    });

    test('should require all patterns in group to match', () => {
      const patternGroups = [[/generate/i, /title/i, /emoji/i]];
      const detector = createDetector(patternGroups);

      // All patterns match
      expect(detector([{ role: 'user', content: 'Generate title with emoji' }])).toBe(true);

      // Only 2 out of 3 patterns match
      expect(detector([{ role: 'user', content: 'Generate title' }])).toBe(false);

      // Only 1 out of 3 patterns match
      expect(detector([{ role: 'user', content: 'Generate something' }])).toBe(false);
    });
  });

  describe('multiple pattern groups', () => {
    test('should detect when any pattern group matches completely', () => {
      const patternGroups = [
        [/openwebui/i, /title/i], // Group 1
        [/librechat/i, /title/i], // Group 2
      ];
      const detector = createDetector(patternGroups);

      // First group matches
      expect(detector([{ role: 'user', content: 'OpenWebUI title generation' }])).toBe(true);

      // Second group matches
      expect(detector([{ role: 'user', content: 'LibreChat title generation' }])).toBe(true);

      // Neither group matches completely
      expect(detector([{ role: 'user', content: 'OpenWebUI tags' }])).toBe(false);
    });

    test('should return true if at least one group matches', () => {
      const patternGroups = [
        [/pattern1/i, /pattern2/i],
        [/pattern3/i, /pattern4/i],
        [/pattern5/i, /pattern6/i],
      ];
      const detector = createDetector(patternGroups);

      // Only middle group matches
      const messages = [{ role: 'user', content: 'pattern3 and pattern4' }];

      expect(detector(messages)).toBe(true);
    });
  });

  describe('message checking', () => {
    test('should check system message content', () => {
      const patternGroups = [[/system.*instruction/i]];
      const detector = createDetector(patternGroups);

      const messages = [
        { role: 'system', content: 'System instruction here' },
        { role: 'user', content: 'Hello' },
      ];

      expect(detector(messages)).toBe(true);
    });

    test('should check last user message content', () => {
      const patternGroups = [[/last.*message/i]];
      const detector = createDetector(patternGroups);

      const messages = [
        { role: 'user', content: 'First message' },
        { role: 'assistant', content: 'Response' },
        { role: 'user', content: 'Last message here' },
      ];

      expect(detector(messages)).toBe(true);
    });

    test('should check both system and last message combined', () => {
      const patternGroups = [[/system/i, /user/i]];
      const detector = createDetector(patternGroups);

      const messages = [
        { role: 'system', content: 'System prompt' },
        { role: 'user', content: 'User message' },
      ];

      expect(detector(messages)).toBe(true);
    });

    test('should handle messages without system role', () => {
      const patternGroups = [[/hello/i]];
      const detector = createDetector(patternGroups);

      const messages = [{ role: 'user', content: 'Hello world' }];

      expect(detector(messages)).toBe(true);
    });

    test('should handle empty content in messages', () => {
      const patternGroups = [[/test/i]];
      const detector = createDetector(patternGroups);

      const messages = [
        { role: 'system', content: '' },
        { role: 'user', content: 'test' },
      ];

      expect(detector(messages)).toBe(true);
    });
  });

  describe('real-world patterns', () => {
    test('should detect OpenWebUI title generation', () => {
      const patternGroups = [
        [/generate a concise.*3-5 word title.*emoji/i, /<chat_history>/i, /<\/chat_history>/i],
      ];
      const detector = createDetector(patternGroups);

      const messages = [
        {
          role: 'system',
          content:
            'Generate a concise, 3-5 word title with an emoji summarizing the chat history.\n<chat_history>\n{{MESSAGES:END:2}}\n</chat_history>',
        },
      ];

      expect(detector(messages)).toBe(true);
    });

    test('should detect LibreChat title generation', () => {
      const patternGroups = [
        [
          /provide a concise.*5-word-or-less title/i,
          /title case conventions/i,
          /only return the title itself/i,
        ],
      ];
      const detector = createDetector(patternGroups);

      const messages = [
        {
          role: 'user',
          content:
            'Provide a concise, 5-word-or-less title for the conversation, using title case conventions. Only return the title itself.',
        },
      ];

      expect(detector(messages)).toBe(true);
    });

    test('should detect OpenWebUI tags generation', () => {
      const patternGroups = [
        [/generate.*1-3.*broad tags.*categorizing/i, /<chat_history>/i, /<\/chat_history>/i],
      ];
      const detector = createDetector(patternGroups);

      const messages = [
        {
          role: 'system',
          content:
            'Generate 1-3 broad tags categorizing the main themes...\n<chat_history>\n{{MESSAGES:END:6}}\n</chat_history>',
        },
      ];

      expect(detector(messages)).toBe(true);
    });

    test('should detect OpenWebUI follow-up questions', () => {
      const patternGroups = [
        [/suggest.*3-5.*follow[-\s]?up questions/i, /<chat_history>/i, /<\/chat_history>/i],
      ];
      const detector = createDetector(patternGroups);

      const messages = [
        {
          role: 'system',
          content:
            'Suggest 3-5 relevant follow-up questions...\n<chat_history>\n{{MESSAGES:END:6}}\n</chat_history>',
        },
      ];

      expect(detector(messages)).toBe(true);
    });

    test('should not detect normal conversation', () => {
      const patternGroups = [
        [/generate a concise.*3-5 word title.*emoji/i, /<chat_history>/i],
        [/provide a concise.*5-word-or-less title/i, /title case conventions/i],
      ];
      const detector = createDetector(patternGroups);

      const messages = [
        { role: 'user', content: 'Hello, how are you?' },
        { role: 'assistant', content: 'I am doing well, thank you!' },
        { role: 'user', content: 'Can you help me with something?' },
      ];

      expect(detector(messages)).toBe(false);
    });
  });

  describe('case sensitivity', () => {
    test('should be case-insensitive when using /i flag', () => {
      const patternGroups = [[/GENERATE/i, /TITLE/i]];
      const detector = createDetector(patternGroups);

      expect(detector([{ role: 'user', content: 'generate title' }])).toBe(true);
      expect(detector([{ role: 'user', content: 'GENERATE TITLE' }])).toBe(true);
      expect(detector([{ role: 'user', content: 'Generate Title' }])).toBe(true);
    });

    test('should be case-sensitive without /i flag', () => {
      const patternGroups = [[/Generate/, /Title/]];
      const detector = createDetector(patternGroups);

      expect(detector([{ role: 'user', content: 'Generate Title' }])).toBe(true);
      expect(detector([{ role: 'user', content: 'generate title' }])).toBe(false);
    });
  });
});
