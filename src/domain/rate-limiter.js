/**
 * Rate Limiter — token bucket algorithm for outbound API calls.
 * Pure domain logic. Satisfies INV-1.
 */

export class RateLimiter {
  constructor({ maxTokens = 10, refillRate = 1, refillInterval = 1000 } = {}) {
    this.maxTokens = maxTokens;
    this.tokens = maxTokens;
    this.refillRate = refillRate;
    this.refillInterval = refillInterval;
    this.lastRefill = Date.now();
  }

  tryAcquire() {
    this._refill();
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return { allowed: true, remaining: Math.floor(this.tokens) };
    }
    const waitMs = Math.ceil((1 - this.tokens) * (this.refillInterval / this.refillRate));
    return { allowed: false, remaining: 0, retryAfter: waitMs };
  }

  _refill() {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    const tokensToAdd = (elapsed / this.refillInterval) * this.refillRate;
    this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }

  get state() {
    this._refill();
    return { tokens: Math.floor(this.tokens), maxTokens: this.maxTokens };
  }
}
