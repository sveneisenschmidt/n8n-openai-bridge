const TaskDetectorService = require('../../src/services/taskDetectorService');
const TaskType = require('../../src/constants/TaskType');

describe('TaskDetectorService', () => {
  let service;

  beforeEach(() => {
    service = new TaskDetectorService();
  });

  describe('registerDetector', () => {
    test('should register a detector callback', () => {
      const mockDetector = jest.fn();

      service.registerDetector(TaskType.GENERATE_TITLE, mockDetector);

      expect(service.detectors.has(TaskType.GENERATE_TITLE)).toBe(true);
      expect(service.detectors.get(TaskType.GENERATE_TITLE)).toBe(mockDetector);
    });

    test('should throw error if callback is not a function', () => {
      expect(() => {
        service.registerDetector(TaskType.GENERATE_TITLE, 'not-a-function');
      }).toThrow('Detector callback must be a function');
    });

    test('should allow overwriting existing detector', () => {
      const firstDetector = jest.fn();
      const secondDetector = jest.fn();

      service.registerDetector(TaskType.GENERATE_TITLE, firstDetector);
      service.registerDetector(TaskType.GENERATE_TITLE, secondDetector);

      expect(service.detectors.get(TaskType.GENERATE_TITLE)).toBe(secondDetector);
    });

    test('should register multiple detectors for different task types', () => {
      const titleDetector = jest.fn();
      const tagsDetector = jest.fn();

      service.registerDetector(TaskType.GENERATE_TITLE, titleDetector);
      service.registerDetector(TaskType.GENERATE_TAGS, tagsDetector);

      expect(service.detectors.size).toBe(2);
      expect(service.detectors.get(TaskType.GENERATE_TITLE)).toBe(titleDetector);
      expect(service.detectors.get(TaskType.GENERATE_TAGS)).toBe(tagsDetector);
    });
  });

  describe('detectTask', () => {
    test('should return false when messages array is empty', () => {
      const result = service.detectTask([]);

      expect(result.isTask).toBe(false);
      expect(result.taskType).toBe(null);
    });

    test('should return false when messages is not an array', () => {
      const result = service.detectTask(null);

      expect(result.isTask).toBe(false);
      expect(result.taskType).toBe(null);
    });

    test('should return false when no detectors are registered', () => {
      const messages = [{ role: 'user', content: 'Hello' }];

      const result = service.detectTask(messages);

      expect(result.isTask).toBe(false);
      expect(result.taskType).toBe(null);
    });

    test('should detect task when detector returns true', () => {
      const mockDetector = jest.fn().mockReturnValue(true);
      service.registerDetector(TaskType.GENERATE_TITLE, mockDetector);

      const messages = [{ role: 'user', content: 'Generate title' }];
      const result = service.detectTask(messages);

      expect(result.isTask).toBe(true);
      expect(result.taskType).toBe(TaskType.GENERATE_TITLE);
      expect(mockDetector).toHaveBeenCalledWith(messages);
    });

    test('should return false when detector returns false', () => {
      const mockDetector = jest.fn().mockReturnValue(false);
      service.registerDetector(TaskType.GENERATE_TITLE, mockDetector);

      const messages = [{ role: 'user', content: 'Normal message' }];
      const result = service.detectTask(messages);

      expect(result.isTask).toBe(false);
      expect(result.taskType).toBe(null);
      expect(mockDetector).toHaveBeenCalledWith(messages);
    });

    test('should check detectors in order and return first match', () => {
      const titleDetector = jest.fn().mockReturnValue(false);
      const tagsDetector = jest.fn().mockReturnValue(true);
      const followUpDetector = jest.fn().mockReturnValue(true);

      service.registerDetector(TaskType.GENERATE_TITLE, titleDetector);
      service.registerDetector(TaskType.GENERATE_TAGS, tagsDetector);
      service.registerDetector(TaskType.GENERATE_FOLLOW_UP_QUESTIONS, followUpDetector);

      const messages = [{ role: 'user', content: 'Generate tags' }];
      const result = service.detectTask(messages);

      expect(result.isTask).toBe(true);
      expect(result.taskType).toBe(TaskType.GENERATE_TAGS);
      expect(titleDetector).toHaveBeenCalled();
      expect(tagsDetector).toHaveBeenCalled();
      // followUpDetector should not be called because tags matched first
    });

    test('should handle detector errors gracefully', () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const errorDetector = jest.fn().mockImplementation(() => {
        throw new Error('Detector error');
      });
      const workingDetector = jest.fn().mockReturnValue(true);

      service.registerDetector(TaskType.GENERATE_TITLE, errorDetector);
      service.registerDetector(TaskType.GENERATE_TAGS, workingDetector);

      const messages = [{ role: 'user', content: 'Test message' }];
      const result = service.detectTask(messages);

      expect(result.isTask).toBe(true);
      expect(result.taskType).toBe(TaskType.GENERATE_TAGS);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringMatching(/Task detector error for generate_title/),
        'Detector error',
      );

      consoleErrorSpy.mockRestore();
    });

    test('should return false when all detectors fail with errors', () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const errorDetector = jest.fn().mockImplementation(() => {
        throw new Error('Detector error');
      });

      service.registerDetector(TaskType.GENERATE_TITLE, errorDetector);

      const messages = [{ role: 'user', content: 'Test message' }];
      const result = service.detectTask(messages);

      expect(result.isTask).toBe(false);
      expect(result.taskType).toBe(null);

      consoleErrorSpy.mockRestore();
    });
  });

  describe('clearDetectors', () => {
    test('should clear all registered detectors', () => {
      const detector1 = jest.fn();
      const detector2 = jest.fn();

      service.registerDetector(TaskType.GENERATE_TITLE, detector1);
      service.registerDetector(TaskType.GENERATE_TAGS, detector2);

      expect(service.detectors.size).toBe(2);

      service.clearDetectors();

      expect(service.detectors.size).toBe(0);
    });

    test('should allow re-registering detectors after clearing', () => {
      const detector1 = jest.fn();
      const detector2 = jest.fn();

      service.registerDetector(TaskType.GENERATE_TITLE, detector1);
      service.clearDetectors();
      service.registerDetector(TaskType.GENERATE_TAGS, detector2);

      expect(service.detectors.size).toBe(1);
      expect(service.detectors.has(TaskType.GENERATE_TAGS)).toBe(true);
    });
  });
});
