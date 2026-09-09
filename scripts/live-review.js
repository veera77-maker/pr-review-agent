const token = process.env.GITHUB_TOKEN;
if (!token) { console.error('Set GITHUB_TOKEN env var'); process.exit(1); }
const h = { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json' };

import { buildContext } from '../src/domain/context-builder.js';
import { runPipeline } from '../src/pipeline/run.js';
import { verifyFindings } from '../src/verify/evidence-verifier.js';
import { formatReview } from '../src/domain/markdown-formatter.js';
import { GitHubClient } from '../src/adapters/github-client.js';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

(async () => {
  const owner = 'veera77-maker';
  const repo = 'ai-engineering';
  const prNumber = 1;

  // 1. Fetch PR metadata from GitHub
  console.log('Fetching PR #' + prNumber + '...');
  const prRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`, { headers: h });
  const pr = await prRes.json();
  console.log('PR:', pr.title);

  // 2. Fetch PR files
  const filesRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/files`, { headers: h });
  const files = await filesRes.json();
  console.log('Files changed:', files.length);

  // 3. Build PR context in our format
  const payload = {
    action: 'opened',
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
      files: files.map(f => ({
        filename: f.filename,
        status: f.status,
        additions: f.additions,
        deletions: f.deletions,
        patch: f.patch || ''
      })),
      commits: [{ sha: pr.head.sha, message: pr.title, author: { name: pr.user.login } }]
    }
  };

  const context = buildContext(payload);
  mkdirSync('output', { recursive: true });
  writeFileSync('output/live-context.json', JSON.stringify(context, null, 2));
  console.log('Context built:', context.files.length, 'files');

  // 4. Run full pipeline (6 agents in parallel)
  console.log('Running 6-agent pipeline...');
  const pipelineResult = await runPipeline(context);
  writeFileSync('output/live-review.json', JSON.stringify(pipelineResult, null, 2));
  console.log('Pipeline found', pipelineResult.findings.length, 'findings');

  // 5. Verify findings (reduce false positives)
  console.log('Verifying findings...');
  const verified = verifyFindings(pipelineResult.findings, context);
  writeFileSync('output/live-verified.json', JSON.stringify(verified, null, 2));
  console.log('Verified:', verified.verified.length, '| Rejected:', verified.rejected.length);
  console.log('FP rate:', verified.summary.false_positive_rate_pct);

  // 6. Build final review with only verified findings
  const finalReview = {
    ...pipelineResult,
    findings: verified.verified,
    summary: {
      ...pipelineResult.summary,
      total: verified.verified.length,
      verified_count: verified.verified.length,
      rejected_count: verified.rejected.length,
      false_positive_rate: verified.summary.false_positive_rate
    }
  };
  const markdown = formatReview(finalReview);
  writeFileSync('output/live-review.md', markdown);
  console.log('Markdown formatted:', markdown.length, 'chars');

  // 7. Post as PR comment
  console.log('Posting review comment...');
  const client = new GitHubClient({ token, timeout: 30000 });
  const result = await client.postPRComment(owner, repo, prNumber, markdown);

  if (result.ok) {
    console.log('SUCCESS! Comment posted.');
    console.log('Comment URL:', result.html_url);
  } else {
    console.log('FAILED:', result.error);
  }
})();
