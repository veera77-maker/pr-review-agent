/**
 * Test Coverage Agent — detects test gaps and missing test files.
 * Pure domain logic. Satisfies INV-1.
 */

export function detectTestIssues(context) {
  const findings = [];

  const sourceFiles = (context.files || []).filter(
    (f) => /\.(js|ts|jsx|tsx|mjs)$/.test(f.filename) && !/test|spec|__tests__/.test(f.filename)
  );
  const testFiles = (context.files || []).filter(
    (f) => /test|spec|__tests__/.test(f.filename) && /\.(js|ts|jsx|tsx|mjs)$/.test(f.filename)
  );

  // Check 1: source files changed without corresponding test changes
  const testMap = new Map(testFiles.map((f) => [normalizeTestPath(f.filename), f]));

  for (const file of sourceFiles) {
    const expectedTest = normalizeTestPath(file.filename);
    if (!testMap.has(expectedTest)) {
      findings.push({
        id: `TEST-MISSING-${file.filename}`,
        rule: 'TEST-MISSING-TEST-FILE',
        severity: 'medium',
        confidence: 0.6,
        category: 'test_coverage',
        file: file.filename,
        line: 1,
        evidence: `Source file ${file.filename} changed but no test file found`,
        impact: 'Regression risk — changes may break existing behavior without detection',
        suggested_fix: `Add or update tests for ${file.filename}`,
      });
    }
  }

  // Check 2: large files with no test coverage
  for (const file of sourceFiles) {
    const totalChanges = (file.additions || 0) + (file.deletions || 0);
    if (totalChanges > 50 && !testMap.has(normalizeTestPath(file.filename))) {
      findings.push({
        id: `TEST-NO-COVERAGE-LARGE-${file.filename}`,
        rule: 'TEST-LARGE-NO-COVERAGE',
        severity: 'high',
        confidence: 0.7,
        category: 'test_coverage',
        file: file.filename,
        line: 1,
        evidence: `Large change (${totalChanges} lines) in ${file.filename} with no test coverage`,
        impact: 'High regression risk — significant changes without verification',
        suggested_fix: `Add comprehensive tests for ${file.filename}`,
      });
    }
  }

  // Check 3: test files that only have imports, no assertions
  for (const file of testFiles) {
    const patch = file.patch || '';
    const hasAssertion = /expect\(|assert\.|should\.|toEqual|toBeTruthy|toBeFalsy/.test(patch);
    const hasTestBlock = /it\(|test\(|describe\(|describe\.only/.test(patch);
    if (hasTestBlock && !hasAssertion && (file.additions || 0) > 3) {
      findings.push({
        id: `TEST-NO-ASSERTION-${file.filename}`,
        rule: 'TEST-NO-ASSERTION',
        severity: 'medium',
        confidence: 0.65,
        category: 'test_coverage',
        file: file.filename,
        line: 1,
        evidence: `Test file ${file.filename} has test blocks but no assertions`,
        impact: 'Tests run but never verify behavior — false sense of coverage',
        suggested_fix: 'Add expect() or assert() calls to verify behavior',
      });
    }
  }

  return findings;
}

function normalizeTestPath(filename) {
  return filename
    .replace(/\.test\.(js|ts|jsx|tsx|mjs)$/, '.$1')
    .replace(/\.spec\.(js|ts|jsx|tsx|mjs)$/, '.$1')
    .replace(/__tests__\//, '');
}
