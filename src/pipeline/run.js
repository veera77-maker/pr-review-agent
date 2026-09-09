#!/usr/bin/env node

/**
 * Pipeline Runner — orchestrates all 6 review agents in parallel.
 * Pure domain logic. Satisfies INV-1.
 *
 * Usage: node run.js --pr <context.json>
 * Output: JSON with merged findings and summary.
 */

import { readFileSync } from 'node:fs';
import { detectBugs } from '../agents/bug-detector.js';
import { detectSecurity } from '../agents/security-detector.js';
import { detectTestIssues } from '../agents/test-coverage.js';
import { detectPerformance } from '../agents/perf-detector.js';
import { detectAPIIssues } from '../agents/api-detector.js';
import { detectQuality } from '../agents/quality-detector.js';
import { mergeFindings } from './finding-merger.js';

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 2) {
    if (argv[i] === '--pr' && argv[i + 1]) {
      args.pr = argv[i + 1];
    }
  }
  return args;
}

const AGENTS = [
  { name: 'bug', fn: detectBugs },
  { name: 'security', fn: detectSecurity },
  { name: 'test', fn: detectTestIssues },
  { name: 'perf', fn: detectPerformance },
  { name: 'api', fn: detectAPIIssues },
  { name: 'quality', fn: detectQuality },
];

export async function runPipeline(context) {
  const startTime = Date.now();

  const agentResults = await Promise.all(
    AGENTS.map(async (agent) => {
      try {
        const result = agent.fn(context);
        const findings = Array.isArray(result)
          ? result
          : result?.findings ?? [];
        return { agent: agent.name, findings, error: null };
      } catch (err) {
        return { agent: agent.name, findings: [], error: err.message };
      }
    })
  );

  const allFindings = [];
  const agentSummaries = [];
  for (const result of agentResults) {
    allFindings.push(...result.findings);
    agentSummaries.push({
      agent: result.agent,
      count: result.findings.length,
      error: result.error,
    });
  }

  const merged = mergeFindings(allFindings);
  const elapsed = Date.now() - startTime;

  return {
    pr_number: context.pr_number,
    title: context.title,
    pipeline: {
      agents: agentSummaries,
      total_raw_findings: allFindings.length,
      after_dedup: merged.findings.length,
      elapsed_ms: elapsed,
    },
    findings: merged.findings,
    summary: merged.summary,
  };
}

// --- CLI entry point ---
if (process.argv[1] && process.argv[1].endsWith('run.js')) {
  const args = parseArgs(process.argv);
  if (!args.pr) {
    console.error('Usage: node run.js --pr <context.json>');
    process.exit(1);
  }
  const context = JSON.parse(readFileSync(args.pr, 'utf8'));
  const result = await runPipeline(context);
  console.log(JSON.stringify(result, null, 2));
}
