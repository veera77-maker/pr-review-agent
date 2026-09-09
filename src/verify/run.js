#!/usr/bin/env node

/**
 * Verify Run — orchestrates evidence verification for all findings.
 * CLI entry point. Satisfies INV-1.
 *
 * Usage: node run.js --findings <findings.json> --context <context.json>
 *   --findings  Path to pipeline output JSON (with findings array)
 *   --context   Path to PR context JSON
 */

import { readFileSync } from 'node:fs';
import { verifyFindings } from './evidence-verifier.js';

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 2) {
    if (argv[i] === '--findings' && argv[i + 1]) args.findings = argv[i + 1];
    if (argv[i] === '--context' && argv[i + 1]) args.context = argv[i + 1];
  }
  return args;
}

if (process.argv[1] && process.argv[1].endsWith('run.js')) {
  const args = parseArgs(process.argv);

  if (!args.findings || !args.context) {
    console.error('Usage: node run.js --findings <findings.json> --context <context.json>');
    process.exit(1);
  }

  const findingsData = JSON.parse(readFileSync(args.findings, 'utf8'));
  const context = JSON.parse(readFileSync(args.context, 'utf8'));

  const findings = findingsData.findings || findingsData;
  const result = verifyFindings(findings, context);

  console.log(JSON.stringify(result, null, 2));
}
