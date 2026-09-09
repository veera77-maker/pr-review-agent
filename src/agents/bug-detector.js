#!/usr/bin/env node

/**
 * Bug Detector Agent — analyzes PR context and produces bug findings.
 * Pure domain logic. No framework imports. Satisfies INV-1.
 *
 * Usage: node bug-detector.js --input <context.json>
 * Output: JSON with findings array.
 */

import { readFileSync } from 'node:fs';

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 2) {
    if (argv[i] === '--input' && argv[i + 1]) {
      args.input = argv[i + 1];
    }
  }
  return args;
}

export function detectBugs(context) {
  const findings = [];

  for (const file of context.files || []) {
    if (!file.patch) continue;

    const addedLines = extractAddedLines(file.patch);
    const allLines = file.patch.split('\n');

    for (const rule of RULES) {
      for (const lineInfo of addedLines) {
        const matches = rule.detect(lineInfo, allLines, file.filename);
        if (matches) {
          findings.push({
            id: `${rule.id}-${file.filename}:${lineInfo.lineno}`,
            rule: rule.id,
            severity: rule.severity,
            confidence: rule.confidence,
            category: rule.category,
            file: file.filename,
            line: lineInfo.lineno,
            evidence: lineInfo.content.trim(),
            impact: rule.impact,
            suggested_fix: rule.suggestFix(lineInfo.content),
          });
        }
      }
    }
  }

  return {
    pr_number: context.pr_number,
    title: context.title,
    findings,
    summary: {
      total: findings.length,
      by_severity: countBy(findings, 'severity'),
      by_category: countBy(findings, 'category'),
    },
  };
}

function extractAddedLines(patch) {
  const lines = [];
  let currentLine = 0;

  for (const rawLine of patch.split('\n')) {
    const hunkMatch = rawLine.match(/^@@ -\d+(?:,\d+)? \+(\d+)/);
    if (hunkMatch) {
      currentLine = parseInt(hunkMatch[1], 10);
      continue;
    }
    if (rawLine.startsWith('+') && !rawLine.startsWith('+++')) {
      lines.push({ lineno: currentLine, content: rawLine.slice(1) });
      currentLine++;
    } else if (!rawLine.startsWith('-') && !rawLine.startsWith('---')) {
      currentLine++;
    }
  }
  return lines;
}

function countBy(arr, key) {
  const counts = {};
  for (const item of arr) {
    counts[item[key]] = (counts[item[key]] || 0) + 1;
  }
  return counts;
}

const RULES = [
  {
    id: 'BUG-NULL-ACCESS',
    severity: 'high',
    confidence: 0.7,
    category: 'null_handling',
    impact: 'Runtime crash (TypeError/NullReferenceError)',
    detect(lineInfo) {
      const code = lineInfo.content;
      if (code.includes('?.') || code.includes('??') || code.includes('||')) return false;
      if (/\b\w+\.\w+\s*[=!<>]/.test(code) && !/\b\w+\?\.\w+/.test(code)) {
        if (/\bthis\.\w+/.test(code)) return false;
        if (/console\.\w+/.test(code)) return false;
        return true;
      }
      return false;
    },
    suggestFix(code) {
      const match = code.match(/(\w+)\.(\w+)/);
      if (match) return `Use optional chaining: ${match[1]}?.${match[2]}`;
      return 'Add null check before property access';
    },
  },
  {
    id: 'BUG-ASSIGNMENT-CONDITION',
    severity: 'critical',
    confidence: 0.9,
    category: 'incorrect_condition',
    impact: 'Logic error — assignment instead of comparison',
    detect(lineInfo) {
      const code = lineInfo.content;
      if (/\bif\s*\([^)]*[^=!<>]=[^=]/.test(code)) return true;
      if (/\bwhile\s*\([^)]*[^=!<>]=[^=]/.test(code)) return true;
      return false;
    },
    suggestFix(code) {
      return 'Use === or == for comparison, not = (assignment)';
    },
  },
  {
    id: 'BUG-OFF-BY-ONE',
    severity: 'medium',
    confidence: 0.6,
    category: 'off_by_one',
    impact: 'Index out of bounds or missed last element',
    detect(lineInfo) {
      const code = lineInfo.content;
      if (/\bfor\s*\(.*<=\s*(array|list|items|length)\b/.test(code)) return true;
      if (/\bi\s*<=\s*\w+\.length\b/.test(code)) return true;
      if (/\bj\s*<=\s*\w+\.length\b/.test(code)) return true;
      return false;
    },
    suggestFix(code) {
      return 'Use < instead of <= for array length bounds';
    },
  },
  {
    id: 'BUG-MISSING-TRY-CATCH',
    severity: 'medium',
    confidence: 0.5,
    category: 'exception_handling',
    impact: 'Unhandled exception crashes process or request',
    detect(lineInfo, allLines, filename) {
      const code = lineInfo.content;
      if (/JSON\.parse\s*\(/.test(code) && !isInsideTryCatch(allLines, lineInfo.lineno)) {
        return true;
      }
      if (/\bfs\.\w+File/.test(code) && !isInsideTryCatch(allLines, lineInfo.lineno)) {
        return true;
      }
      return false;
    },
    suggestFix(code) {
      return 'Wrap in try-catch block';
    },
  },
  {
    id: 'BUG-UNSAFE-REGEX',
    severity: 'high',
    confidence: 0.8,
    category: 'security',
    impact: 'ReDoS — regex can hang on malicious input',
    detect(lineInfo) {
      const code = lineInfo.content;
      if (/new\s+RegExp\(/.test(code) && !/escapeRegex/.test(code)) return true;
      if (/\bmatch\s*\(\s*\/.*\+\*.*\/\)/.test(code)) return true;
      return false;
    },
    suggestFix(code) {
      return 'Use a safe regex library or add input length limit before matching';
    },
  },
  {
    id: 'BUG-RACE-CONDITION',
    severity: 'high',
    confidence: 0.4,
    category: 'concurrency',
    impact: 'Shared state modified without synchronization',
    detect(lineInfo) {
      const code = lineInfo.content;
      if (/globalThis\.\w+\s*[+\-]?=/.test(code)) return true;
      if (/\bmodule\.exports\.\w+\s*=/ .test(code)) return true;
      return false;
    },
    suggestFix(code) {
      return 'Use a mutex/lock or make state immutable';
    },
  },
];

function isInsideTryCatch(allLines, targetLine) {
  let depth = 0;
  for (let i = 0; i < allLines.length; i++) {
    const line = allLines[i];
    if (line.includes('try')) depth++;
    if (line.includes('catch')) depth--;
    if (depth > 0 && i + 1 === targetLine) return true;
  }
  return false;
}

// --- CLI entry point ---
if (process.argv[1] && process.argv[1].endsWith('bug-detector.js')) {
  const args = parseArgs(process.argv);
  if (!args.input) {
    console.error('Usage: node bug-detector.js --input <context.json>');
    process.exit(1);
  }
  const context = JSON.parse(readFileSync(args.input, 'utf8'));
  const result = detectBugs(context);
  console.log(JSON.stringify(result, null, 2));
}
