/**
 * Webhook Verifier — HMAC-SHA256 signature verification for GitHub webhooks.
 * Pure domain logic. Satisfies INV-1.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';

export function verifySignature(payload, signatureHeader, secret) {
  if (!signatureHeader || !secret) {
    return { valid: false, reason: 'Missing signature or secret' };
  }

  const expectedPrefix = 'sha256=';
  if (!signatureHeader.startsWith(expectedPrefix)) {
    return { valid: false, reason: 'Invalid signature format' };
  }

  const signature = signatureHeader.slice(expectedPrefix.length);
  const hmac = createHmac('sha256', secret);
  hmac.update(payload);
  const digest = hmac.digest('hex');

  try {
    const sigBuf = Buffer.from(signature, 'hex');
    const digestBuf = Buffer.from(digest, 'hex');
    if (sigBuf.length !== digestBuf.length) {
      return { valid: false, reason: 'Signature length mismatch' };
    }
    const valid = timingSafeEqual(sigBuf, digestBuf);
    return valid
      ? { valid: true }
      : { valid: false, reason: 'Signature mismatch' };
  } catch {
    return { valid: false, reason: 'Invalid signature encoding' };
  }
}
