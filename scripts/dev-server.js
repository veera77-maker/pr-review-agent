#!/usr/bin/env node

/**
 * Dev Server — starts ngrok tunnel + webhook server for local development.
 * Loads .env, starts ngrok, then starts the webhook server.
 *
 * Usage: node scripts/dev-server.js
 * Requires: ngrok installed (`npm i -g ngrok` or `brew install ngrok`)
 */

import { readFileSync, existsSync } from 'node:fs';
import { spawn, execSync } from 'node:child_process';
import { join } from 'node:path';
import { createWebhookServer } from '../src/adapters/webhook-server.js';

// 1. Load .env file
const envPath = join(process.cwd(), '.env');
if (existsSync(envPath)) {
  const envContent = readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex > 0) {
      const key = trimmed.slice(0, eqIndex).trim();
      const value = trimmed.slice(eqIndex + 1).trim();
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  }
  console.log('Loaded .env');
}

// 2. Check for ngrok
function findNgrok() {
  const candidates = ['ngrok'];
  for (const cmd of candidates) {
    try {
      execSync(`${cmd} version`, { stdio: 'ignore' });
      return cmd;
    } catch {
      // not found
    }
  }
  return null;
}

// 3. Start ngrok
async function startNgrok(port) {
  console.log('Starting ngrok tunnel...');
  const ngrok = spawn('ngrok', ['http', String(port)], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  return new Promise((resolve, reject) => {
    let url = null;
    const timeout = setTimeout(() => {
      reject(new Error('ngrok timed out — is it installed?'));
    }, 10000);

    ngrok.stdout.on('data', (data) => {
      const text = data.toString();
      // ngrok prints the URL to stdout
      const match = text.match(/https:\/\/[a-z0-9]+\.ngrok(?:-free)?\.app/);
      if (match && !url) {
        url = match[0];
        clearTimeout(timeout);
        console.log(`ngrok tunnel: ${url}`);
        console.log(`Set this as your GitHub webhook URL: ${url}/webhook`);
        resolve({ process: ngrok, url });
      }
    });

    ngrok.stderr.on('data', (data) => {
      const text = data.toString();
      // ngrok logs to stderr, look for the URL there too
      const match = text.match(/https:\/\/[a-z0-9]+\.ngrok(?:-free)?\.app/);
      if (match && !url) {
        url = match[0];
        clearTimeout(timeout);
        console.log(`ngrok tunnel: ${url}`);
        console.log(`Set this as your GitHub webhook URL: ${url}/webhook`);
        resolve({ process: ngrok, url });
      }
    });

    ngrok.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

// 4. Main
async function main() {
  const port = Number(process.env.PORT) || 3000;

  console.log('=== PR Review Agent — Dev Server ===');
  console.log(`Port: ${port}`);
  console.log(`GitHub token: ${process.env.GITHUB_TOKEN ? 'configured' : 'MISSING'}`);
  console.log(`Webhook secret: ${process.env.WEBHOOK_SECRET ? 'configured' : 'MISSING'}`);
  console.log('');

  // Start ngrok
  let ngrokProcess = null;
  let publicUrl = null;
  try {
    const ngrok = await startNgrok(port);
    ngrokProcess = ngrok.process;
    publicUrl = ngrok.url;
  } catch (err) {
    console.warn(`ngrok failed: ${err.message}`);
    console.warn('Starting server without tunnel (local only)');
    console.warn('Install ngrok: https://ngrok.com/download');
  }

  // Start webhook server
  console.log('');
  console.log('Starting webhook server...');
  const server = createWebhookServer();
  server.listen(port, () => {
    console.log(`Server listening on http://localhost:${port}`);
    console.log('');
    console.log('=== Setup Instructions ===');
    if (publicUrl) {
      console.log(`1. Go to your GitHub repo → Settings → Webhooks → Add webhook`);
      console.log(`2. Payload URL: ${publicUrl}/webhook`);
      console.log(`3. Content type: application/json`);
      console.log(`4. Secret: (value from .env WEBHOOK_SECRET)`);
      console.log(`5. Events: Select "Pull requests"`);
    } else {
      console.log('1. Start ngrok in another terminal: ngrok http 3000');
      console.log('2. Use the ngrok URL as your webhook payload URL');
    }
    console.log('');
    console.log('Press Ctrl+C to stop');
  });

  // Cleanup on exit
  process.on('SIGINT', () => {
    console.log('\nShutting down...');
    server.close();
    if (ngrokProcess) ngrokProcess.kill();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
