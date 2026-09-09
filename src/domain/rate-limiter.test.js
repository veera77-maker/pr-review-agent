import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { RateLimiter } from '../domain/rate-limiter.js';

describe('rate-limiter', () => {
  it('allows requests under limit', () => {
    const limiter = new RateLimiter({ maxTokens: 3, refillRate: 1, refillInterval: 1000 });
    const r1 = limiter.tryAcquire();
    assert.equal(r1.allowed, true);
    assert.equal(r1.remaining, 2);
  });

  it('rejects when exhausted', () => {
    const limiter = new RateLimiter({ maxTokens: 2, refillRate: 1, refillInterval: 60000 });
    limiter.tryAcquire();
    limiter.tryAcquire();
    const r3 = limiter.tryAcquire();
    assert.equal(r3.allowed, false);
    assert.ok(r3.retryAfter > 0);
  });

  it('refills over time', async () => {
    const limiter = new RateLimiter({ maxTokens: 1, refillRate: 10, refillInterval: 100 });
    limiter.tryAcquire();
    await new Promise((r) => setTimeout(r, 150));
    const r = limiter.tryAcquire();
    assert.equal(r.allowed, true);
  });

  it('reports state', () => {
    const limiter = new RateLimiter({ maxTokens: 5 });
    const s = limiter.state;
    assert.equal(s.maxTokens, 5);
    assert.ok(s.tokens <= 5);
  });
});
