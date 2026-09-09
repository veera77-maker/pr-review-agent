import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DeliveryDedup } from '../domain/dedup-store.js';

describe('dedup-store', () => {
  it('marks new deliveries as not duplicate', () => {
    const dedup = new DeliveryDedup();
    assert.equal(dedup.isDuplicate('delivery-1'), false);
  });

  it('marks seen deliveries as duplicate', () => {
    const dedup = new DeliveryDedup();
    dedup.isDuplicate('delivery-1');
    assert.equal(dedup.isDuplicate('delivery-1'), true);
  });

  it('allows different delivery IDs', () => {
    const dedup = new DeliveryDedup();
    dedup.isDuplicate('delivery-1');
    assert.equal(dedup.isDuplicate('delivery-2'), false);
  });

  it('expires old entries', async () => {
    const dedup = new DeliveryDedup({ ttlMs: 50 });
    dedup.isDuplicate('delivery-1');
    assert.equal(dedup.isDuplicate('delivery-1'), true);
    await new Promise((r) => setTimeout(r, 80));
    assert.equal(dedup.isDuplicate('delivery-1'), false);
  });

  it('reports size', () => {
    const dedup = new DeliveryDedup();
    assert.equal(dedup.size, 0);
    dedup.isDuplicate('a');
    dedup.isDuplicate('b');
    assert.equal(dedup.size, 2);
  });
});
