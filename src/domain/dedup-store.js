/**
 * Deduplication Store — prevents re-processing duplicate webhook deliveries.
 * Pure domain logic. Satisfies INV-1.
 *
 * Uses delivery IDs from GitHub's X-GitHub-Delivery header.
 * Auto-expires entries after TTL to prevent memory leaks.
 */

export class DeliveryDedup {
  constructor({ ttlMs = 300000 } = {}) {
    this.seen = new Map();
    this.ttlMs = ttlMs;
  }

  isDuplicate(deliveryId) {
    this._cleanup();
    if (this.seen.has(deliveryId)) {
      return true;
    }
    this.seen.set(deliveryId, Date.now());
    return false;
  }

  _cleanup() {
    const now = Date.now();
    for (const [id, timestamp] of this.seen) {
      if (now - timestamp > this.ttlMs) {
        this.seen.delete(id);
      }
    }
  }

  get size() {
    this._cleanup();
    return this.seen.size;
  }
}
