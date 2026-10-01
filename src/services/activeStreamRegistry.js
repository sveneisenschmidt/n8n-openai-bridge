/*
 * In-memory registry for active LibreChat Server-Sent Event connections.
 *
 * Entries are deliberately process-local. The bridge must therefore run with a
 * single worker whenever OpenAI-compatible tool-proxy calls need to emit to the client stream.
 */
class ActiveStreamRegistry {
  constructor({ ttlMs = 600000, sweepIntervalMs = 60000, now = () => Date.now() } = {}) {
    this.ttlMs = ttlMs;
    this.now = now;
    this.streams = new Map();
    this.sweepTimer = setInterval(() => this.sweep(), sweepIntervalMs);
    this.sweepTimer.unref?.();
  }

  register(streamId, res, model) {
    this.streams.set(streamId, {
      res,
      createdAt: this.now(),
      streamId,
      model,
      externalToolCalls: [],
      externalToolCallIds: new Set(),
      completedExternalToolCallIds: new Set(),
    });
  }

  get(streamId) {
    return this.streams.get(streamId);
  }

  delete(streamId) {
    return this.streams.delete(streamId);
  }

  sweep() {
    const expiresAt = this.now() - this.ttlMs;
    for (const [streamId, entry] of this.streams.entries()) {
      if (entry.createdAt <= expiresAt || entry.res.writableEnded || entry.res.destroyed) {
        this.streams.delete(streamId);
      }
    }
  }

  close() {
    clearInterval(this.sweepTimer);
    this.streams.clear();
  }
}

module.exports = ActiveStreamRegistry;
