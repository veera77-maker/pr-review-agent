/**
 * Code Quality Agent — detects code quality and maintainability issues.
 * Pure domain logic. Satisfies INV-1.
 */

export function detectQuality(context) {
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
    id: 'QUAL-MAGIC-NUMBER',
    severity: 'low',
    confidence: 0.5,
    category: 'code_quality',
    impact: 'Magic number reduces readability and maintainability',
    detect(lineInfo) {
      const c = lineInfo.content;
      if (/(?:if|while|for)\s*\(.*[^a-zA-Z]\b(?!0\b|1\b|2\b)\d{2,}\b/.test(c)) return true;
      if (/setTimeout|setInterval/.test(c) && /\d{4,}/.test(c)) return true;
      return false;
    },
    suggestFix() { return 'Extract magic numbers into named constants'; },
  },
  {
    id: 'QUAL-DEEP-NESTING',
    severity: 'medium',
    confidence: 0.6,
    category: 'code_quality',
    impact: 'Deep nesting reduces readability and increases error risk',
    detect(lineInfo) {
      const c = lineInfo.content;
      const indent = c.match(/^\s*/)?.[0]?.length || 0;
      if (indent >= 24) return true; // 6 levels deep (4 spaces each)
      return false;
    },
    suggestFix() { return 'Extract inner logic into a helper function'; },
  },
  {
    id: 'QUAL-CONSOLE-LOG',
    severity: 'low',
    confidence: 0.9,
    category: 'code_quality',
    impact: 'Console.log left in code — leaks info in production',
    detect(lineInfo) {
      const c = lineInfo.content;
      if (/console\.(log|debug|info|warn|error)\(/.test(c)) return true;
      return false;
    },
    suggestFix() { return 'Remove console statements or use a proper logger'; },
  },
  {
    id: 'QUAL-TODO-FIXME',
    severity: 'low',
    confidence: 0.95,
    category: 'code_quality',
    impact: 'TODO/FIXME left in code — unresolved technical debt',
    detect(lineInfo) {
      const c = lineInfo.content;
      if (/\b(TODO|FIXME|HACK|XXX)\b/.test(c)) return true;
      return false;
    },
    suggestFix() { return 'Resolve before merging or create a tracked issue'; },
  },
  {
    id: 'QUAL-VERY-LONG-FUNCTION',
    severity: 'medium',
    confidence: 0.5,
    category: 'code_quality',
    impact: 'Long function — hard to test, understand, and maintain',
    detect(lineInfo, allLines) {
      const c = lineInfo.content;
      if (/function\s+\w+|=>\s*\{/.test(c)) {
        const startIdx = allLines.findIndex((l) => l.includes(c.trim()));
        if (startIdx >= 0) {
          let depth = 0;
          for (let i = startIdx; i < Math.min(startIdx + 100, allLines.length); i++) {
            depth += (allLines[i].match(/{/g) || []).length;
            depth -= (allLines[i].match(/}/g) || []).length;
            if (depth <= 0 && i > startIdx + 30) return true;
          }
        }
      }
      return false;
    },
    suggestFix() { return 'Split into smaller functions with single responsibility'; },
  },
  {
    id: 'QUAL-MISSING-TYPE-ANNOTATION',
    severity: 'low',
    confidence: 0.3,
    category: 'code_quality',
    impact: 'Missing type annotation — harder to catch bugs at compile time',
    detect(lineInfo) {
      const c = lineInfo.content;
      if (/function\s+\w+\([^)]*\)\s*\{/.test(c) && !/:\s*(string|number|boolean|any|void|object)/.test(c)) {
        return true;
      }
      return false;
    },
    suggestFix() { return 'Add TypeScript type annotations'; },
  },
];
