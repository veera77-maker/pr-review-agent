import { createHmac } from 'node:crypto';
import { createWebhookServer } from '../src/adapters/webhook-server.js';

process.env.WEBHOOK_SECRET = 'test-secret';
process.env.GITHUB_TOKEN = 'dummy';

const server = createWebhookServer();
server.listen(3006, async () => {
  const secret = 'test-secret';
  const payload = JSON.stringify({
    action: 'opened',
    pull_request: { number: 1, title: 'test', body: '', state: 'open',
      user: { login: 'dev' }, base: { ref: 'main' }, head: { ref: 'test' },
      html_url: 'https://github.com/test/repo/pull/1', changed_files: 0 },
    repository: { full_name: 'test/repo' },
  });
  const sig = 'sha256=' + createHmac('sha256', secret).update(payload).digest('hex');

  // Test 1: Valid signature — should pass verification, fail at GitHub API (dummy token)
  const res1 = await fetch('http://localhost:3006/webhook', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-hub-signature-256': sig,
      'x-github-event': 'pull_request',
      'x-github-delivery': 'test-1',
    },
    body: payload,
  });
  const d1 = await res1.json();
  console.log('Test 1 - Valid sig:', res1.status !== 401 ? 'PASS' : 'FAIL', `(${res1.status})`);

  // Test 2: Invalid signature — should reject with 401
  const res2 = await fetch('http://localhost:3006/webhook', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-hub-signature-256': 'sha256=deadbeef',
      'x-github-event': 'pull_request',
    },
    body: payload,
  });
  console.log('Test 2 - Invalid sig:', res2.status === 401 ? 'PASS' : 'FAIL', `(${res2.status})`);

  // Test 3: Duplicate delivery — should skip
  const res3 = await fetch('http://localhost:3006/webhook', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-hub-signature-256': sig,
      'x-github-event': 'pull_request',
      'x-github-delivery': 'test-1',
    },
    body: payload,
  });
  const d3 = await res3.json();
  console.log('Test 3 - Duplicate:', d3.skipped === 'duplicate' ? 'PASS' : 'FAIL');

  // Test 4: Health check
  const res4 = await fetch('http://localhost:3006/health');
  const d4 = await res4.json();
  console.log('Test 4 - Health:', d4.status === 'ok' ? 'PASS' : 'FAIL');

  // Test 5: Missing signature — should reject
  const res5 = await fetch('http://localhost:3006/webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-github-event': 'pull_request' },
    body: payload,
  });
  console.log('Test 5 - No sig:', res5.status === 401 ? 'PASS' : 'FAIL', `(${res5.status})`);

  server.close();
  process.exit(0);
});
