#!/usr/bin/env node

/**
 * Review Action — runs the PR review pipeline for GitHub Actions.
 * Reuses all existing domain logic. Never embeds the pipeline in Actions.
 * Token comes from GITHUB_TOKEN env var (GitHub Actions secret).
 */

import { buildContext } from '../src/domain/context-builder.js';
import { runPipeline } from '../src/pipeline/run.js';
import { verifyFindings } from '../src/verify/evidence-verifier.js';
import { formatReview } from '../src/domain/markdown-formatter.js';
import { GitHubClient } from '../src/adapters/github-client.js';
import { readFileSync } from 'node:fs';

function parseEvent() {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!eventPath) {
    throw new Error('GITHUB_EVENT_PATH not set — must run in GitHub Actions');
  }
  return JSON.parse(readFileSync(eventPath, 'utf8'));
}

function parseRepoSlug() {
  const repo = process.env.GITHUB_REPOSITORY;
  if (!repo) throw new Error('GITHUB_REPOSITORY not set');
  const [owner, name] = repo.split('/');
  return { owner, repo: name };
}

async function fetchPRFiles(owner, repo, prNumber, token) {
  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/files`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
      },
    }
  );
  if (!res.ok) throw new Error(`Failed to fetch PR files: ${res.status}`);
  return res.json();
}

async function main() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    console.error('GITHUB_TOKEN not set — cannot post review');
    process.exit(1);
  }

  const event = await parseEvent();
  const { owner, repo } = parseRepoSlug();
  const prNumber = event.pull_request.number;

  console.log(`Reviewing PR #${prNumber} in ${owner}/${repo}`);

  // 1. Fetch PR files from GitHub API
  const files = await fetchPRFiles(owner, repo, prNumber, token);

  // 2. Build context (reuses existing domain logic)
  const payload = {
    action: event.action,
    pull_request: {
      number: event.pull_request.number,
      title: event.pull_request.title,
      body: event.pull_request.body,
      state: event.pull_request.state,
      user: { login: event.pull_request.user.login },
      base: { ref: event.pull_request.base.ref },
      head: { ref: event.pull_request.head.ref },
      html_url: event.pull_request.html_url,
      changed_files: event.pull_request.changed_files,
      files: files.map((f) => ({
        filename: f.filename,
        status: f.status,
        additions: f.additions,
        deletions: f.deletions,
        patch: f.patch || '',
      })),
      commits: [
        {
          sha: event.pull_request.head.sha,
          message: event.pull_request.title,
          author: { name: event.pull_request.user.login },
        },
      ],
    },
  };

  const context = buildContext(payload);
  console.log(`Context: ${context.files.length} files`);

  // 3. Run 6-agent pipeline (reuses existing pipeline logic)
  const pipelineResult = await runPipeline(context);
  console.log(`Pipeline: ${pipelineResult.findings.length} raw findings`);

  // 4. Verify findings (reuses existing verification logic)
  const verified = verifyFindings(pipelineResult.findings, context);
  console.log(`Verified: ${verified.verified.length} | Rejected: ${verified.rejected.length}`);

  // 5. Format as markdown (reuses existing formatter)
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
  const markdown = formatReview(finalReview);

  // 6. Post review comment (reuses existing GitHub client with timeout — INV-2)
  const client = new GitHubClient({ token, timeout: 30000 });
  const result = await client.postPRComment(owner, repo, prNumber, markdown);

  if (result.ok) {
    console.log(`Review posted: ${result.html_url}`);
  } else {
    console.error(`Failed to post review: ${result.error}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Review failed:', err.message);
  process.exit(1);
});
