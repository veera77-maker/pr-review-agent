/**
 * Retry Queue — graceful degradation when API is unavailable.
 * Pure domain logic. Satisfies INV-1.
 */

export class RetryQueue {
  constructor({ maxRetries = 3, baseDelay = 1000, maxDelay = 30000 } = {}) {
    this.maxRetries = maxRetries;
    this.baseDelay = baseDelay;
    this.maxDelay = maxDelay;
    this.queue = [];
    this.processing = false;
  }

  enqueue(task) {
    return new Promise((resolve, reject) => {
      this.queue.push({ task, resolve, reject, attempts: 0 });
      this._process();
    });
  }

  async _process() {
    if (this.processing) return;
    this.processing = true;

    while (this.queue.length > 0) {
      const item = this.queue[0];
      item.attempts++;

      try {
        const result = await item.task();
        item.resolve(result);
        this.queue.shift();
      } catch (err) {
        if (item.attempts >= this.maxRetries) {
          item.reject(err);
          this.queue.shift();
        } else {
          const delay = this._calculateDelay(item.attempts);
          await this._sleep(delay);
        }
      }
    }

    this.processing = false;
  }

  _calculateDelay(attempt) {
    const delay = this.baseDelay * Math.pow(2, attempt - 1);
    return Math.min(delay, this.maxDelay);
  }

  _sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  get size() {
    return this.queue.length;
  }

  get stats() {
    return { queued: this.queue.length, processing: this.processing };
  }
}
