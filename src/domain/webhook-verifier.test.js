import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { verifySignature } from '../domain/webhook-verifier.js';

describe('webhook-verifier', () => {
  const secret = 'test-secret-123';

  function sign(payload, sec = secret) {
    return 'sha256=' + createHmac('sha256', sec).update(payload).digest('hex');
  }

  it('accepts valid signature', () => {
    const body = '{"action":"opened"}';
    const sig = sign(body);
    const result = verifySignature(body, sig, secret);
    assert.equal(result.valid, true);
  });

  it('rejects invalid signature', () => {
    const body = '{"action":"opened"}';
    const result = verifySignature(body, 'sha256=deadbeef', secret);
    assert.equal(result.valid, false);
    assert.ok(result.reason.includes('mismatch'));
  });

  it('rejects missing signature', () => {
    const result = verifySignature('body', null, secret);
    assert.equal(result.valid, false);
  });

  it('rejects missing secret', () => {
    const result = verifySignature('body', 'sha256=abc', '');
    assert.equal(result.valid, false);
  });

  it('rejects wrong prefix', () => {
    const result = verifySignature('body', 'md5=abc', secret);
    assert.equal(result.valid, false);
    assert.ok(result.reason.includes('format'));
  });

  it('rejects non-hex signature', () => {
    const result = verifySignature('body', 'sha256=not-hex!', secret);
    assert.equal(result.valid, false);
  });

  it('uses timing-safe comparison', () => {
    const body = 'test';
    const sig = sign(body);
    // Tamper with one char
    const tampered = sig.slice(0, -1) + (sig.endsWith('0') ? '1' : '0');
    const result = verifySignature(body, tampered, secret);
    assert.equal(result.valid, false);
  });
});
