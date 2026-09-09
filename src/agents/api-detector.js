/**
 * API Compatibility Agent — detects API/contract breaking changes.
 * Pure domain logic. Satisfies INV-1.
 */

export function detectAPIIssues(context) {
  const findings = [];

  for (const file of context.files || []) {
    if (!file.patch) continue;
    const addedLines = extractAddedLines(file.patch);
    const removedLines = extractRemovedLines(file.patch);
    const allLines = file.patch.split('\n');

    // Check for removed exports
    for (const lineInfo of removedLines) {
      const c = lineInfo.content;
      if (/export\s+(function|class|const|let|var|default)\s+\w+/.test(c)) {
        const name = c.match(/export\s+(?:function|class|const|let|var|default)\s+(\w+)/)?.[1];
        if (name) {
          findings.push({
            id: `API-REMOVED-EXPORT-${file.filename}:${name}`,
            rule: 'API-REMOVED-EXPORT',
            severity: 'high',
            confidence: 0.8,
            category: 'api_compatibility',
            file: file.filename,
            line: lineInfo.lineno,
            evidence: c.trim(),
            impact: `Breaking change — removed export "${name}" may break consumers`,
            suggested_fix: `Keep the export and mark as deprecated, or provide a migration path`,
          });
        }
      }
    }

    // Check for changed function signatures
    for (const lineInfo of addedLines) {
      const c = lineInfo.content;
      if (/export\s+(async\s+)?function\s+\w+\s*\(/.test(c)) {
        const paramCount = (c.match(/,/g) || []).length + 1;
        const fname = c.match(/function\s+(\w+)/)?.[1];
        if (paramCount > 6) {
          findings.push({
            id: `API-MANY-PARAMS-${file.filename}:${fname}`,
            rule: 'API-MANY-PARAMS',
            severity: 'medium',
            confidence: 0.6,
            category: 'api_compatibility',
            file: file.filename,
            line: lineInfo.lineno,
            evidence: c.trim(),
            impact: `Function "${fname}" has ${paramCount} parameters — hard to maintain and test`,
            suggested_fix: 'Group related parameters into an options object',
          });
        }
      }
    }

    // Check for missing API versioning
    for (const lineInfo of addedLines) {
      const c = lineInfo.content;
      if (/app\.(get|post|put|delete|patch)\s*\(\s*['"`]\//.test(c) && !/v\d/.test(c)) {
        findings.push({
          id: `API-NO-VERSION-${file.filename}:${lineInfo.lineno}`,
          rule: 'API-NO-VERSION',
          severity: 'low',
          confidence: 0.5,
          category: 'api_compatibility',
          file: file.filename,
          line: lineInfo.lineno,
          evidence: c.trim(),
          impact: 'Unversioned endpoint — harder to introduce breaking changes later',
          suggested_fix: 'Add API version prefix (e.g., /v1/resource)',
        });
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

function extractRemovedLines(patch) {
  const lines = [];
  let currentLine = 0;
  for (const rawLine of patch.split('\n')) {
    const hunk = rawLine.match(/^@@ -(\d+)/);
    if (hunk) { currentLine = parseInt(hunk[1], 10); continue; }
    if (rawLine.startsWith('-') && !rawLine.startsWith('---')) {
      lines.push({ lineno: currentLine, content: rawLine.slice(1) });
    } else if (!rawLine.startsWith('+') && !rawLine.startsWith('+++')) {
      currentLine++;
    }
  }
  return lines;
}
