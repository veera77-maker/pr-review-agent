/**
 * Webhook Server — HTTP adapter for GitHub webhooks.
 * Handles HMAC-SHA256 verification, PR events, deduplication.
 * Uses Node.js built-in http module. No framework. Satisfies INV-1.
 *
 * Endpoints:
 *   GET  /health        — health check (200 OK)
 *   POST /webhook       — GitHub webhook receiver
 *   GET  /webhook       — 405 Method Not Allowed
 */

import { createServer } from 'node:http';
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { verifySignature } from '../domain/webhook-verifier.js';
import { DeliveryDedup } from '../domain/dedup-store.js';
import { buildContext } from '../domain/context-builder.js';
import { validate } from './validator.js';

const PORT = Number(process.env.PORT) || 3000;
const OUTPUT_DIR = join(process.cwd(), 'output');
const dedup = new DeliveryDedup({ ttlMs: 300000 });

// Lazy-load pipeline to avoid circular imports at module level
let pipelineReady = false;
async function runReviewPipeline(context) {
  if (!pipelineReady) {
    const { runPipeline } = await import('../pipeline/run.js');
    const { verifyFindings } = await import('../verify/evidence-verifier.js');
    const { formatReview } = await import('../domain/markdown-formatter.js');
    globalThis._reviewDeps = { runPipeline, verifyFindings, formatReview };
    pipelineReady = true;
  }
  const { runPipeline, verifyFindings, formatReview } = globalThis._reviewDeps;

  const pipelineResult = await runPipeline(context);
  const verified = verifyFindings(pipelineResult.findings, context);
  const finalReview = {
    ...pipelineResult,
    findings: verified.verified,
    summary: {
      ...pipelineResult.summary,
      total: verified.verified.length,
      verified_count: verified.verified.length,
      rejected_count: verified.rejected.length,
      false_positive_rate: verified.summary.false_positive_rate,
    },
  };
  return formatReview(finalReview);
}

async function postReviewComment(owner, repo, prNumber, markdown) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    console.warn('GITHUB_TOKEN not set — skipping comment post');
    return null;
  }
  const { GitHubClient } = await import('./github-client.js');
  const client = new GitHubClient({ token, timeout: 30000 });
  return client.postPRComment(owner, repo, prNumber, markdown);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function sendJSON(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

export function createWebhookServer() {
  return createServer(async (req, res) => {
    // Health check
    if (req.method === 'GET' && req.url === '/health') {
      sendJSON(res, 200, { status: 'ok', dedup_size: dedup.size });
      return;
    }

    // Webhook endpoint
    if (req.url === '/webhook') {
      if (req.method !== 'POST') {
        sendJSON(res, 405, { error: 'Method not allowed' });
        return;
      }

      // 1. Read raw body for signature verification
      const rawBody = await readBody(req);

      // 2. Verify HMAC-SHA256 signature (INV-3: untrusted input)
      const signature = req.headers['x-hub-signature-256'];
      const { valid, reason } = verifySignature(rawBody, signature, process.env.WEBHOOK_SECRET || '');
      if (!valid) {
        console.warn(`Signature verification failed: ${reason}`);
        sendJSON(res, 401, { error: 'Invalid signature', details: reason });
        return;
      }

      // 3. Deduplication check
      const deliveryId = req.headers['x-github-delivery'];
      if (deliveryId && dedup.isDuplicate(deliveryId)) {
        console.log(`Duplicate delivery ${deliveryId} — skipping`);
        sendJSON(res, 200, { ok: true, skipped: 'duplicate' });
        return;
      }

      // 4. Parse payload
      let payload;
      try {
        payload = JSON.parse(rawBody.toString('utf8'));
      } catch {
        sendJSON(res, 400, { error: 'Invalid JSON' });
        return;
      }

      // 5. Handle pull_request events
      const event = req.headers['x-github-event'];
      if (event === 'pull_request') {
        const action = payload.action;
        if (!['opened', 'synchronize', 'reopened'].includes(action)) {
          sendJSON(res, 200, { ok: true, skipped: `action: ${action}` });
          return;
        }

        const pr = payload.pull_request;
        const repoSlug = payload.repository?.full_name || '';
        const [owner, repo] = repoSlug.split('/');

        console.log(`PR event: #${pr.number} ${action} on ${repoSlug}`);

        // 6. Fetch PR files from GitHub API
        const token = process.env.GITHUB_TOKEN;
        if (!token) {
          sendJSON(res, 500, { error: 'GITHUB_TOKEN not configured' });
          return;
        }

        const filesRes = await fetch(
          `https://api.github.com/repos/${owner}/${repo}/pulls/${pr.number}/files`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: 'application/vnd.github+json',
            },
          }
        );

        if (!filesRes.ok) {
          sendJSON(res, 502, { error: `GitHub API error: ${filesRes.status}` });
          return;
        }

        const files = await filesRes.json();

        // 7. Build context
        const contextPayload = {
          action,
          pull_request: {
            number: pr.number,
            title: pr.title,
            body: pr.body,
            state: pr.state,
            user: { login: pr.user.login },
            base: { ref: pr.base.ref },
            head: { ref: pr.head.ref },
            html_url: pr.html_url,
            changed_files: pr.changed_files,
            files: files.map((f) => ({
              filename: f.filename,
              status: f.status,
              additions: f.additions,
              deletions: f.deletions,
              patch: f.patch || '',
            })),
            commits: [
              {
                sha: pr.head.sha,
                message: pr.title,
                author: { name: pr.user.login },
              },
            ],
          },
        };

        const context = buildContext(contextPayload);

        // 8. Run review pipeline (async — don't block the response)
        sendJSON(res, 200, { ok: true, processing: true, pr: pr.number });

        try {
          const markdown = await runReviewPipeline(context);
          const result = await postReviewComment(owner, repo, pr.number, markdown);
          if (result?.ok) {
            console.log(`Review posted: ${result.html_url}`);
          } else {
            console.error('Failed to post review:', result?.error);
          }
        } catch (err) {
          console.error('Pipeline error:', err.message);
        }

        return;
      }

      // 9. Other events — acknowledge
      sendJSON(res, 200, { ok: true, skipped: `event: ${event}` });
      return;
    }

    sendJSON(res, 404, { error: 'Not found' });
  });
}

// CLI entry point
if (process.argv[1] && process.argv[1].endsWith('webhook-server.js')) {
  if (!process.env.WEBHOOK_SECRET) {
    console.warn('WARNING: WEBHOOK_SECRET not set — signature verification disabled');
  }
  const server = createWebhookServer();
  server.listen(PORT, () => {
    console.log(`Webhook server listening on http://localhost:${PORT}`);
    console.log(`Health: http://localhost:${PORT}/health`);
    console.log(`Webhook: POST http://localhost:${PORT}/webhook`);
  });
}
