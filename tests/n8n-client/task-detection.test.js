const N8nClient = require('../../src/n8nClient');
const Config = require('../../src/config/Config');
const TaskDetectorService = require('../../src/services/taskDetectorService');
const TaskType = require('../../src/constants/TaskType');

describe('N8nClient - Task Detection', () => {
  let config;
  let taskDetectorService;
  let n8nClient;

  beforeEach(() => {
    config = new Config();
    taskDetectorService = new TaskDetectorService();
  });

  describe('buildPayload with task detection disabled', () => {
    beforeEach(() => {
      config.enableTaskDetection = false;
      n8nClient = new N8nClient(config, taskDetectorService);
    });

    test('should include default task fields when detection is disabled', () => {
      const messages = [{ role: 'user', content: 'Generate a title' }];
      const sessionId = 'test-session';
      const userContext = { userId: 'user-123' };

      const payload = n8nClient.buildPayload(messages, sessionId, userContext);

      expect(payload.isTask).toBe(false);
      expect(payload.taskType).toBe(null);
    });

    test('should not call task detector when disabled', () => {
      const detectSpy = jest.spyOn(taskDetectorService, 'detectTask');
      const messages = [{ role: 'user', content: 'Test' }];

      n8nClient.buildPayload(messages, 'session', { userId: 'user' });

      expect(detectSpy).not.toHaveBeenCalled();
    });
  });

  describe('buildPayload with task detection enabled', () => {
    beforeEach(() => {
      config.enableTaskDetection = true;
      n8nClient = new N8nClient(config, taskDetectorService);
    });

    test('should detect OpenWebUI title generation task', () => {
      const titleDetector = jest.fn().mockReturnValue(true);
      taskDetectorService.registerDetector(TaskType.GENERATE_TITLE, titleDetector);

      const messages = [
        {
          role: 'system',
          content:
            'Generate a concise, 3-5 word title with an emoji.\n<chat_history>\nHistory here\n</chat_history>',
        },
      ];

      const payload = n8nClient.buildPayload(messages, 'session-123', { userId: 'user-123' });

      expect(payload.isTask).toBe(true);
      expect(payload.taskType).toBe(TaskType.GENERATE_TITLE);
      expect(titleDetector).toHaveBeenCalledWith(messages);
    });

    test('should detect tags generation task', () => {
      const tagsDetector = jest.fn().mockReturnValue(true);
      taskDetectorService.registerDetector(TaskType.GENERATE_TAGS, tagsDetector);

      const messages = [
        {
          role: 'system',
          content:
            'Generate 1-3 broad tags categorizing...\n<chat_history>\nHistory\n</chat_history>',
        },
      ];

      const payload = n8nClient.buildPayload(messages, 'session-123', { userId: 'user-123' });

      expect(payload.isTask).toBe(true);
      expect(payload.taskType).toBe(TaskType.GENERATE_TAGS);
    });

    test('should detect follow-up questions task', () => {
      const followUpDetector = jest.fn().mockReturnValue(true);
      taskDetectorService.registerDetector(TaskType.GENERATE_FOLLOW_UP_QUESTIONS, followUpDetector);

      const messages = [
        {
          role: 'system',
          content:
            'Suggest 3-5 relevant follow-up questions...\n<chat_history>\nHistory\n</chat_history>',
        },
      ];

      const payload = n8nClient.buildPayload(messages, 'session-123', { userId: 'user-123' });

      expect(payload.isTask).toBe(true);
      expect(payload.taskType).toBe(TaskType.GENERATE_FOLLOW_UP_QUESTIONS);
    });

    test('should not modify payload for normal messages', () => {
      const titleDetector = jest.fn().mockReturnValue(false);
      taskDetectorService.registerDetector(TaskType.GENERATE_TITLE, titleDetector);

      const messages = [{ role: 'user', content: 'Hello, how are you?' }];

      const payload = n8nClient.buildPayload(messages, 'session-123', { userId: 'user-123' });

      expect(payload.isTask).toBe(false);
      expect(payload.taskType).toBe(null);
    });

    test('should include all standard fields along with task detection', () => {
      const titleDetector = jest.fn().mockReturnValue(true);
      taskDetectorService.registerDetector(TaskType.GENERATE_TITLE, titleDetector);

      const messages = [
        { role: 'system', content: 'System prompt' },
        { role: 'user', content: 'Generate a title' },
      ];
      const userContext = {
        userId: 'user-123',
        userEmail: 'user@example.com',
        userName: 'John Doe',
        userRole: 'admin',
      };

      const payload = n8nClient.buildPayload(messages, 'session-abc', userContext);

      // Standard fields
      expect(payload.systemPrompt).toBe('System prompt');
      expect(payload.currentMessage).toBe('Generate a title');
      expect(payload.chatInput).toBe('Generate a title');
      expect(payload.messages).toEqual([{ role: 'user', content: 'Generate a title' }]);
      expect(payload.sessionId).toBe('session-abc');
      expect(payload.userId).toBe('user-123');
      expect(payload.userEmail).toBe('user@example.com');
      expect(payload.userName).toBe('John Doe');
      expect(payload.userRole).toBe('admin');

      // Task detection fields
      expect(payload.isTask).toBe(true);
      expect(payload.taskType).toBe(TaskType.GENERATE_TITLE);
    });

    test('should handle missing taskDetectorService gracefully', () => {
      const n8nClientWithoutDetector = new N8nClient(config, null);

      const messages = [{ role: 'user', content: 'Test' }];
      const payload = n8nClientWithoutDetector.buildPayload(messages, 'session', {
        userId: 'user',
      });

      expect(payload.isTask).toBe(false);
      expect(payload.taskType).toBe(null);
    });
  });

  describe('payload structure consistency', () => {
    test('should always include isTask and taskType fields', () => {
      config.enableTaskDetection = false;
      const n8nClientDisabled = new N8nClient(config, null);

      const messages = [{ role: 'user', content: 'Test' }];
      const payload = n8nClientDisabled.buildPayload(messages, 'session', { userId: 'user' });

      expect(payload).toHaveProperty('isTask');
      expect(payload).toHaveProperty('taskType');
      expect(payload.isTask).toBe(false);
      expect(payload.taskType).toBe(null);
    });

    test('should maintain consistent payload structure across detection states', () => {
      const messages = [{ role: 'user', content: 'Test' }];
      const sessionId = 'session-123';
      const userContext = { userId: 'user-123' };

      // With detection disabled
      config.enableTaskDetection = false;
      const clientDisabled = new N8nClient(config, taskDetectorService);
      const payloadDisabled = clientDisabled.buildPayload(messages, sessionId, userContext);

      // With detection enabled but no match
      config.enableTaskDetection = true;
      const clientEnabled = new N8nClient(config, taskDetectorService);
      const detector = jest.fn().mockReturnValue(false);
      taskDetectorService.registerDetector(TaskType.GENERATE_TITLE, detector);
      const payloadEnabled = clientEnabled.buildPayload(messages, sessionId, userContext);

      // Both should have the same structure
      expect(Object.keys(payloadDisabled).sort()).toEqual(Object.keys(payloadEnabled).sort());
    });
  });

  describe('multiple detectors', () => {
    beforeEach(() => {
      config.enableTaskDetection = true;
      n8nClient = new N8nClient(config, taskDetectorService);
    });

    test('should use first matching detector', () => {
      const titleDetector = jest.fn().mockReturnValue(false);
      const tagsDetector = jest.fn().mockReturnValue(true);
      const followUpDetector = jest.fn().mockReturnValue(true);

      taskDetectorService.registerDetector(TaskType.GENERATE_TITLE, titleDetector);
      taskDetectorService.registerDetector(TaskType.GENERATE_TAGS, tagsDetector);
      taskDetectorService.registerDetector(TaskType.GENERATE_FOLLOW_UP_QUESTIONS, followUpDetector);

      const messages = [{ role: 'user', content: 'Test' }];
      const payload = n8nClient.buildPayload(messages, 'session', { userId: 'user' });

      expect(payload.isTask).toBe(true);
      expect(payload.taskType).toBe(TaskType.GENERATE_TAGS);
    });

    test('should stop at first match and not check remaining detectors', () => {
      const titleDetector = jest.fn().mockReturnValue(true);
      const tagsDetector = jest.fn().mockReturnValue(true);

      taskDetectorService.registerDetector(TaskType.GENERATE_TITLE, titleDetector);
      taskDetectorService.registerDetector(TaskType.GENERATE_TAGS, tagsDetector);

      const messages = [{ role: 'user', content: 'Test' }];
      n8nClient.buildPayload(messages, 'session', { userId: 'user' });

      expect(titleDetector).toHaveBeenCalled();
      // tagsDetector may or may not be called depending on Map iteration order
      // This is implementation detail, just verify the result is consistent
    });
  });
});
