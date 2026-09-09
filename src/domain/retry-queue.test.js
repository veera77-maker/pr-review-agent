import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { RetryQueue } from '../domain/retry-queue.js';

describe('retry-queue', () => {
  it('executes successful tasks', async () => {
    const queue = new RetryQueue({ maxRetries: 2, baseDelay: 10 });
    const result = await queue.enqueue(() => 'done');
    assert.equal(result, 'done');
  });

  it('retries on failure then succeeds', async () => {
    const queue = new RetryQueue({ maxRetries: 3, baseDelay: 10 });
    let attempts = 0;
    const result = await queue.enqueue(() => {
      attempts++;
      if (attempts < 2) throw new Error('fail');
      return 'ok';
    });
    assert.equal(result, 'ok');
    assert.equal(attempts, 2);
  });

  it('rejects after max retries', async () => {
    const queue = new RetryQueue({ maxRetries: 2, baseDelay: 10 });
    try {
      await queue.enqueue(() => { throw new Error('always fail'); });
      assert.fail('Should have thrown');
    } catch (err) {
      assert.equal(err.message, 'always fail');
    }
  });

  it('reports stats', () => {
    const queue = new RetryQueue();
    const s = queue.stats;
    assert.equal(typeof s.queued, 'number');
    assert.equal(typeof s.processing, 'boolean');
  });
});
