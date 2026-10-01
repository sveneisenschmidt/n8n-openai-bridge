const ActiveStreamRegistry = require('../src/services/activeStreamRegistry');

describe('ActiveStreamRegistry', () => {
  test('removes entries whose response was closed', () => {
    const now = 1000;
    const registry = new ActiveStreamRegistry({
      ttlMs: 100,
      sweepIntervalMs: 100000,
      now: () => now,
    });
    registry.register('active', { writableEnded: false, destroyed: false }, 'model-a');
    registry.register('closed', { writableEnded: true, destroyed: false }, 'model-b');

    registry.sweep();

    expect(registry.get('active').model).toBe('model-a');
    expect(registry.get('closed')).toBeUndefined();
    registry.close();
  });

  test('expires abandoned stream entries by TTL', () => {
    let now = 1000;
    const registry = new ActiveStreamRegistry({
      ttlMs: 100,
      sweepIntervalMs: 100000,
      now: () => now,
    });
    registry.register('expired', { writableEnded: false, destroyed: false }, 'model-a');
    now = 1100;

    registry.sweep();

    expect(registry.get('expired')).toBeUndefined();
    registry.close();
  });
});
