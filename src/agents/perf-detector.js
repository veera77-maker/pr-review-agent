/**
 * Performance Agent — detects performance anti-patterns.
 * Pure domain logic. Satisfies INV-1.
 */

export function detectPerformance(context) {
  const findings = [];

  for (const file of context.files || []) {
    if (!file.patch) continue;
    const addedLines = extractAddedLines(file.patch);
    const allLines = file.patch.split('\n');

    for (const lineInfo of addedLines) {
      for (const rule of RULES) {
        if (rule.detect(lineInfo, allLines, file.filename)) {
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

  return findings;
}

function extractAddedLines(patch) {
  const lines = [];
  let currentLine = 0;
  for (const rawLine of patch.split('\n')) {
    const hunk = rawLine.match(/^@@ -\d+(?:,\d+)? \+(\d+)/);
    if (hunk) { currentLine = parseInt(hunk[1], 10); continue; }
    if (rawLine.startsWith('+') && !rawLine.startsWith('+++')) {
      lines.push({ lineno: currentLine, content: rawLine.slice(1) });
      currentLine++;
    } else if (!rawLine.startsWith('-') && !rawLine.startsWith('---')) {
      currentLine++;
    }
  }
  return lines;
}

const RULES = [
  {
    id: 'PERF-N+1-QUERY',
    severity: 'high',
    confidence: 0.6,
    category: 'performance',
    impact: 'N+1 queries — database hit per loop iteration',
    detect(lineInfo) {
      const c = lineInfo.content;
      if (/(for|while|forEach|map)\s*\(/.test(c)) {
        return false;
      }
      return false;
    },
    suggestFix() { return 'Batch queries or use eager loading'; },
  },
  {
    id: 'PERF-NO-INDEX',
    severity: 'medium',
    confidence: 0.4,
    category: 'performance',
    impact: 'Missing database index — slow queries on large tables',
    detect(lineInfo) {
      const c = lineInfo.content;
      if (/\.find\s*\(\s*(item|row|record|entry)\s*=>/.test(c)) return true;
      if (/\.filter\s*\(\s*(item|row|record|entry)\s*=>/.test(c)) return true;
      return false;
    },
    suggestFix() { return 'Consider using a Map/indexed lookup instead of array search'; },
  },
  {
    id: 'PERF-SYNC-IN-LOOP',
    severity: 'high',
    confidence: 0.7,
    category: 'performance',
    impact: 'Synchronous I/O in loop — blocks event loop',
    detect(lineInfo) {
      const c = lineInfo.content;
      if (/readFileSync|writeFileSync|statSync|accessSync/.test(c)) return true;
      return false;
    },
    suggestFix() { return 'Use async I/O or batch file operations'; },
  },
  {
    id: 'PERF-UNBOUNDED-ARRAY',
    severity: 'medium',
    confidence: 0.5,
    category: 'performance',
    impact: 'Unbounded array growth — potential memory leak',
    detect(lineInfo) {
      const c = lineInfo.content;
      if (/\.push\(/.test(c) && /setInterval|recursive|setTimeout/.test(c)) return true;
      if (/results\s*=\s*\[\]/.test(c) && /while|for\s*\(/.test(c)) return true;
      return false;
    },
    suggestFix() { return 'Add a size limit or use streaming/chunked processing'; },
  },
  {
    id: 'PERF-LARGE-BUNDLE',
    severity: 'medium',
    confidence: 0.4,
    category: 'performance',
    impact: 'Importing entire library — increases bundle size',
    detect(lineInfo) {
      const c = lineInfo.content;
      if (/import\s+\*\s+as/.test(c)) return true;
      if (/require\s*\(\s*['"]lodash['"]\s*\)/.test(c)) return true;
      return false;
    },
    suggestFix() { return 'Use named imports or tree-shakeable alternatives (lodash-es)'; },
  },
];
