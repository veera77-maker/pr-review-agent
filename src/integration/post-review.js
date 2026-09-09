#!/usr/bin/env node

/**
 * Post Review — formats findings as markdown and posts to GitHub.
 * Integration layer. Satisfies INV-1 (no domain logic here).
 *
 * Usage: node post-review.js --pr-number <N> --review <path> [--dry-run]
 *   --pr-number  GitHub PR number
 *   --review     Path to review JSON file (from pipeline output)
 *   --dry-run    Print markdown without posting
 *   --owner      GitHub owner (default: from GITHUB_REPOSITORY env)
 *   --repo       GitHub repo (default: from GITHUB_REPOSITORY env)
 */

import { readFileSync } from 'node:fs';
import { formatReview } from '../domain/markdown-formatter.js';
import { GitHubClient } from '../adapters/github-client.js';

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    switch (argv[i]) {
      case '--pr-number': args.prNumber = Number(argv[++i]); break;
      case '--review': args.reviewPath = argv[++i]; break;
      case '--dry-run': args.dryRun = true; break;
      case '--owner': args.owner = argv[++i]; break;
      case '--repo': args.repo = argv[++i]; break;
    }
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv);

  if (!args.prNumber || !args.reviewPath) {
    console.error('Usage: node post-review.js --pr-number <N> --review <path> [--dry-run]');
    process.exit(1);
  }

  const review = JSON.parse(readFileSync(args.reviewPath, 'utf8'));
  const markdown = formatReview(review);

  if (args.dryRun) {
    console.log(markdown);
    return;
  }

  const repoSlug = process.env.GITHUB_REPOSITORY || '';
  const [owner, repo] = args.owner && args.repo
    ? [args.owner, args.repo]
    : repoSlug.split('/');

  if (!owner || !repo) {
    console.error('Set GITHUB_REPOSITORY=owner/repo or use --owner and --repo flags');
    process.exit(1);
  }

  const client = new GitHubClient({ timeout: 30000 });
  const result = await client.postPRComment(owner, repo, args.prNumber, markdown);

  if (result.ok) {
    console.log(JSON.stringify({ ok: true, comment_id: result.comment_id, html_url: result.html_url }));
  } else if (result.error === 'rate_limited') {
    console.error(`Rate limited. Retry after ${result.retryAfter}ms`);
    process.exit(2);
  } else {
    console.error(`Failed: ${result.error}`);
    process.exit(1);
  }
}

main();
