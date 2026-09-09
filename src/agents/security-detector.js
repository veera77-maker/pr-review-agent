/**
 * Security Agent — detects security vulnerabilities in PR code.
 * Pure domain logic. Satisfies INV-1.
 */

export function detectSecurity(context) {
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
    id: 'SEC-SQL-INJECTION',
    severity: 'critical',
    confidence: 0.85,
    category: 'security',
    impact: 'SQL injection — attacker can execute arbitrary queries',
    detect(lineInfo) {
      const c = lineInfo.content;
      if (/\+\s*['"`]/.test(c) && /SELECT|INSERT|UPDATE|DELETE|DROP/i.test(c)) return true;
      if (/\$\{.*\}.*SELECT|query\s*\(\s*['"`]\s*\+/.test(c)) return true;
      return false;
    },
    suggestFix() { return 'Use parameterized queries instead of string concatenation'; },
  },
  {
    id: 'SEC-XSS',
    severity: 'high',
    confidence: 0.7,
    category: 'security',
    impact: 'Cross-site scripting — attacker can inject scripts',
    detect(lineInfo) {
      const c = lineInfo.content;
      if (/dangerouslySetInnerHTML/.test(c)) return true;
      if (/innerHTML\s*=/.test(c)) return true;
      if (/document\.write\s*\(/.test(c)) return true;
      return false;
    },
    suggestFix() { return 'Use textContent or a safe HTML sanitizer'; },
  },
  {
    id: 'SEC-HARDCODED-SECRET',
    severity: 'critical',
    confidence: 0.8,
    category: 'security',
    impact: 'Hardcoded secret — credentials exposed in source code',
    detect(lineInfo) {
      const c = lineInfo.content;
      if (/password\s*[:=]\s*['"`][^'"`]+['"`]/i.test(c)) return true;
      if (/api[_-]?key\s*[:=]\s*['"`][^'"`]+['"`]/i.test(c)) return true;
      if (/secret\s*[:=]\s*['"`][^'"`]+['"`]/i.test(c)) return true;
      if (/token\s*[:=]\s*['"`][A-Za-z0-9+/=_-]{20,}['"`]/i.test(c)) return true;
      return false;
    },
    suggestFix() { return 'Use environment variables or a secrets manager'; },
  },
  {
    id: 'SEC-PATH-TRAVERSAL',
    severity: 'high',
    confidence: 0.75,
    category: 'security',
    impact: 'Path traversal — attacker can access files outside intended directory',
    detect(lineInfo) {
      const c = lineInfo.content;
      if (/\.\.[\\/]/.test(c) && /readFile|writeFile|createReadStream/.test(c)) return true;
      if (/path\.join\s*\([^)]*\.\./.test(c)) return true;
      return false;
    },
    suggestFix() { return 'Validate and sanitize file paths; use path.resolve with a base directory'; },
  },
  {
    id: 'SEC-NO-AUTH-CHECK',
    severity: 'high',
    confidence: 0.5,
    category: 'security',
    impact: 'Missing authorization — endpoint may be accessible without authentication',
    detect(lineInfo, allLines, filename) {
      const c = lineInfo.content;
      if (/app\.(get|post|put|delete)\s*\(/.test(c) || /router\.(get|post|put|delete)\s*\(/.test(c)) {
        const ctx = allLines.slice(Math.max(0, lineInfo.lineno - 3), lineInfo.lineno + 3).join('\n');
        if (!/auth|authenticate|verify.*token|session|cookie/i.test(ctx)) return true;
      }
      return false;
    },
    suggestFix() { return 'Add authentication middleware before the route handler'; },
  },
];
