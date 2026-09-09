/**
 * Evidence Verifier — validates findings against codebase context.
 * Pure domain logic. Satisfies INV-1.
 *
 * For each finding, examines the surrounding patch context to determine
 * if the finding is real or a false positive.
 */

export function verifyFindings(findings, context) {
  const verified = [];
  const rejected = [];

  for (const finding of findings) {
    const file = (context.files || []).find((f) => f.filename === finding.file);
    if (!file || !file.patch) {
      // Some findings (e.g., TEST-MISSING) don't need line-level context
      const ruleVerifier = VERIFIERS[finding.rule];
      if (ruleVerifier) {
        const result = ruleVerifier(finding, null, [], file || null, context);
        if (result.verified) {
          verified.push({ ...finding, verification: 'verified', reason: result.reason });
        } else {
          rejected.push({ ...finding, verification: 'rejected', reason: result.reason });
        }
        continue;
      }
      verified.push({ ...finding, verification: 'unverified', reason: 'No file context available' });
      continue;
    }

    const result = verifyFinding(finding, file, context);
    if (result.verified) {
      verified.push({ ...finding, verification: 'verified', reason: result.reason });
    } else {
      rejected.push({ ...finding, verification: 'rejected', reason: result.reason });
    }
  }

  const total = verified.length + rejected.length;
  const falsePositiveRate = total > 0 ? rejected.length / total : 0;

  return {
    verified,
    rejected,
    summary: {
      total_findings: total,
      verified_count: verified.length,
      rejected_count: rejected.length,
      false_positive_rate: Math.round(falsePositiveRate * 1000) / 1000,
      false_positive_rate_pct: (falsePositiveRate * 100).toFixed(1) + '%',
    },
  };
}

function verifyFinding(finding, file, context) {
  const allLines = file.patch.split('\n');
  const addedLines = extractAddedLines(file.patch);

  // Some findings use line: 1 as sentinel (e.g., TEST-MISSING) — check rule-specific verifier first
  const ruleVerifier = VERIFIERS[finding.rule];
  if (ruleVerifier) {
    const lineInfo = addedLines.find((l) => l.lineno === finding.line);
    const surroundingLines = lineInfo ? getSurroundingContext(allLines, finding.line, 5) : [];
    return ruleVerifier(finding, lineInfo, surroundingLines, file, context);
  }

  const lineInfo = addedLines.find((l) => l.lineno === finding.line);

  if (!lineInfo) {
    return { verified: false, reason: 'Finding line not found in patch diff' };
  }

  const surroundingLines = getSurroundingContext(allLines, finding.line, 5);
  return { verified: true, reason: 'No specific rejection rule — kept by default' };
}

const VERIFIERS = {
  'BUG-NULL-ACCESS': (finding, lineInfo, surrounding) => {
    const code = lineInfo?.content || '';
    if (!code) {
      return { verified: true, reason: 'No code context — finding kept by default' };
    }
    // Check if there's already a null check nearby
    const hasNullGuard = surrounding.some((l) =>
      /\?\.\s|!==?\s*null|!==?\s*undefined|\?\?|\bif\s*\(!?\s*\w+/.test(l)
    );
    if (hasNullGuard) {
      return { verified: false, reason: 'Null guard found in surrounding context' };
    }
    // Check if the object is likely always defined (e.g., this.* from constructor)
    if (/this\.\w+/.test(code)) {
      return { verified: true, reason: 'Property access on this — likely initialized in constructor' };
    }
    return { verified: true, reason: 'No null guard found — finding stands' };
  },

  'BUG-ASSIGNMENT-CONDITION': (finding, lineInfo) => {
    const code = lineInfo?.content || '';
    if (!code) {
      return { verified: true, reason: 'No code context — finding kept by default' };
    }
    // Check if it's inside a comment
    if (/^\s*\/\//.test(code)) {
      return { verified: false, reason: 'Assignment is inside a comment' };
    }
    // Check if it's inside a string
    if (/['"`].*=.*['"`]/.test(code) && !/if\s*\(/.test(code)) {
      return { verified: false, reason: 'Assignment is inside a string literal' };
    }
    return { verified: true, reason: 'Real assignment in condition — finding stands' };
  },

  'BUG-OFF-BY-ONE': (finding, lineInfo, surrounding) => {
    const code = lineInfo?.content || '';
    if (!code) {
      return { verified: true, reason: 'No code context — finding kept by default' };
    }
    // Check if there's an explicit length check before the loop
    const hasLengthCheck = surrounding.some((l) =>
      /\.length\s*[><=!]+\s*\d+|if\s*\(.*\.length/.test(l)
    );
    if (hasLengthCheck) {
      return { verified: false, reason: 'Explicit length guard found in surrounding context' };
    }
    return { verified: true, reason: 'No length guard — off-by-one stands' };
  },

  'BUG-MISSING-TRY-CATCH': (finding, lineInfo, surrounding) => {
    const code = lineInfo?.content || '';
    if (!code) {
      return { verified: true, reason: 'No code context — finding kept by default' };
    }
    // Check if there's a try-catch wrapping this
    const fullContext = surrounding.join('\n');
    if (/try\s*\{/.test(fullContext) && fullContext.indexOf('try') < fullContext.indexOf(code.trim())) {
      return { verified: false, reason: 'try-catch found wrapping this code' };
    }
    // Check if there's .catch() on the promise chain
    if (/\.catch\s*\(/.test(fullContext)) {
      return { verified: false, reason: '.catch() handler found in context' };
    }
    return { verified: true, reason: 'No error handling found — finding stands' };
  },

  'BUG-UNSAFE-REGEX': (finding, lineInfo, surrounding) => {
    const code = lineInfo?.content || '';
    // Check if there's a length limit or input validation nearby
    const hasGuard = surrounding.some((l) =>
      /length\s*[<>]|substr|slice|maxLength|LIMIT/.test(l)
    );
    if (hasGuard) {
      return { verified: false, reason: 'Input length guard found in surrounding context' };
    }
    if (!code) {
      return { verified: true, reason: 'No code context — finding kept by default' };
    }
    return { verified: true, reason: 'No input guard — unsafe regex stands' };
  },

  'BUG-RACE-CONDITION': (finding, lineInfo, surrounding) => {
    const code = lineInfo?.content || '';
    if (!code) {
      return { verified: true, reason: 'No code context — finding kept by default' };
    }
    // Check if there's a lock/mutex nearby
    const hasLock = surrounding.some((l) =>
      /mutex|lock|atomic|synchronized|semaphore/.test(l)
    );
    if (hasLock) {
      return { verified: false, reason: 'Synchronization primitive found in context' };
    }
    return { verified: true, reason: 'No synchronization — race condition stands' };
  },

  'SEC-SQL-INJECTION': (finding, lineInfo) => {
    const code = lineInfo?.content || '';
    if (!code) {
      return { verified: true, reason: 'No code context — finding kept by default' };
    }
    // Check if it uses parameterized query
    if (/\?|%s|\$\d+|prepare|bind|parameterize/.test(code)) {
      return { verified: false, reason: 'Parameterized query detected' };
    }
    // Check if it's not actually SQL
    if (!/SELECT|INSERT|UPDATE|DELETE|FROM|WHERE|JOIN/i.test(code)) {
      return { verified: false, reason: 'No SQL keywords — likely not a SQL query' };
    }
    return { verified: true, reason: 'String concatenation in SQL — injection risk stands' };
  },

  'SEC-NO-AUTH-CHECK': (finding, lineInfo, surrounding) => {
    const fullContext = surrounding.join('\n');
    // Check if there's auth middleware applied higher up
    if (/app\.use\s*\([^)]*auth|useAuth|requireAuth|authenticate/.test(fullContext)) {
      return { verified: false, reason: 'Auth middleware found in application context' };
    }
    return { verified: true, reason: 'No auth middleware visible — finding stands' };
  },

  'PERF-SYNC-IN-LOOP': (finding, lineInfo, surrounding, file) => {
    // Check the full patch for loop constructs, not just surrounding lines
    const fullPatch = file?.patch || '';
    const hasLoop = /for\s*\(|while\s*\(|\.forEach\s*\(|\.map\s*\(/.test(fullPatch);
    if (!hasLoop) {
      return { verified: false, reason: 'No loop construct found in file patch' };
    }
    // Check if the sync call is in the same function as a loop
    const lines = fullPatch.split('\n');
    const syncLineIdx = lines.findIndex((l) => l.includes('readFileSync') || l.includes('writeFileSync'));
    if (syncLineIdx >= 0) {
      // Look backwards for a loop start
      for (let i = syncLineIdx - 1; i >= Math.max(0, syncLineIdx - 20); i--) {
        if (/for\s*\(|while\s*\(|\.forEach\s*\(/.test(lines[i])) {
          return { verified: true, reason: 'Sync I/O confirmed inside loop — finding stands' };
        }
        if (/^(export\s+|class\s+|async\s+)/.test(lines[i].replace(/^[+-]/, ''))) {
          break; // Hit function boundary
        }
      }
    }
    return { verified: false, reason: 'Sync call not inside loop in same function scope' };
  },

  'TEST-MISSING-TEST-FILE': (finding, lineInfo, surrounding, file, context) => {
    // Check if there are test files covering this source file
    const sourceFile = finding.file;
    const testFiles = (context.files || []).filter((f) =>
      /test|spec|__tests__/.test(f.filename)
    );
    const hasMatchingTest = testFiles.some((tf) => {
      const normalized = tf.filename
        .replace(/\.test\.\w+$/, '')
        .replace(/\.spec\.\w+$/, '')
        .replace(/__tests__\//, '');
      return sourceFile.includes(normalized) || normalized.includes(sourceFile.replace(/\.\w+$/, ''));
    });
    if (hasMatchingTest) {
      return { verified: false, reason: 'Test file found covering this source' };
    }
    return { verified: true, reason: 'No matching test file — missing test stands' };
  },

  'QUAL-CONSOLE-LOG': (finding, lineInfo) => {
    const code = lineInfo?.content || '';
    if (!code) {
      return { verified: true, reason: 'No code context — finding kept by default' };
    }
    // Check if it's in a test file
    if (/test|spec/.test(finding.file)) {
      return { verified: false, reason: 'console.log in test file is acceptable' };
    }
    // Check if it's behind a debug flag
    if (/debug|verbose|LOG_LEVEL/.test(code)) {
      return { verified: false, reason: 'Conditional logging behind debug flag' };
    }
    return { verified: true, reason: 'Unconditional console.log — finding stands' };
  },

  'QUAL-TODO-FIXME': (finding, lineInfo) => {
    // TODOs are always valid findings
    return { verified: true, reason: 'TODO/FIXME present in code' };
  },
};

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

function getSurroundingContext(allLines, targetLine, radius) {
  const start = Math.max(0, targetLine - radius - 1);
  const end = Math.min(allLines.length, targetLine + radius);
  return allLines.slice(start, end).map((l) => l.replace(/^[+-]/, ''));
}
