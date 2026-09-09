/**
 * Webhook Server — HTTP adapter.
 * Uses Node.js built-in http module. No framework. Satisfies INV-1.
 */

import { createServer } from 'node:http';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { buildContext } from '../domain/context-builder.js';
import { validate } from './validator.js';

const PORT = Number(process.env.PORT) || 3000;
const OUTPUT_DIR = join(process.cwd(), 'output');

export function createWebhookServer() {
  return createServer(async (req, res) => {
    if (req.method === 'GET' && req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok' }));
      return;
    }

    if (req.method === 'POST' && req.url === '/webhook') {
      let body = '';
      for await (const chunk of req) {
        body += chunk;
      }

      let payload;
      try {
        payload = JSON.parse(body);
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
        return;
      }

      const { valid, errors, sanitized } = validate(payload);
      if (!valid) {
        res.writeHead(422, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Validation failed', details: errors }));
        return;
      }

      const context = buildContext(sanitized);

      mkdirSync(OUTPUT_DIR, { recursive: true });
      const prNumber = context.pr_number || 0;
      const outPath = join(OUTPUT_DIR, `pr-${prNumber}-context.json`);
      writeFileSync(outPath, JSON.stringify(context, null, 2));

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, output: outPath, context }));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  });
}

if (process.argv[1] && process.argv[1].endsWith('webhook-server.js')) {
  const server = createWebhookServer();
  server.listen(PORT, () => {
    console.log(`Webhook server listening on http://localhost:${PORT}`);
  });
}
