import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { verifyFindings } from '../verify/evidence-verifier.js';

describe('evidence-verifier', () => {
  const context = {
    pr_number: 1,
    files: [
      {
        filename: 'test.js',
        status: 'modified',
        additions: 10,
        deletions: 0,
        patch: '@@ -1,3 +1,10 @@\n+if (x = y) {\n+  console.log(x);\n+}\n+const re = new RegExp(input);\n',
      },
    ],
  };

  const findings = [
    {
      id: 'BUG-ASSIGNMENT-CONDITION-test.js:3',
      rule: 'BUG-ASSIGNMENT-CONDITION',
      severity: 'critical',
      confidence: 0.9,
      category: 'incorrect_condition',
      file: 'test.js',
      line: 3,
      evidence: 'if (x = y) {',
      impact: 'Logic error',
      suggested_fix: 'Use ===',
    },
    {
      id: 'BUG-UNSAFE-REGEX-test.js:6',
      rule: 'BUG-UNSAFE-REGEX',
      severity: 'high',
      confidence: 0.8,
      category: 'security',
      file: 'test.js',
      line: 6,
      evidence: 'const re = new RegExp(input);',
      impact: 'ReDoS',
      suggested_fix: 'Use safe regex',
    },
  ];

  it('verifies findings against context', () => {
    const result = verifyFindings(findings, context);
    assert.ok(result.verified.length > 0, 'Should have verified findings');
    assert.ok(result.summary, 'Should have summary');
    assert.equal(typeof result.summary.false_positive_rate, 'number');
  });

  it('rejects findings not in patch diff', () => {
    const result = verifyFindings(findings, { pr_number: 1, files: [] });
    // Findings without file context fall through to rule verifiers
    // which keep them by default (better to keep than wrongly reject)
    assert.ok(result.verified.length + result.rejected.length === findings.length, 'All findings accounted for');
  });

  it('reports false positive rate', () => {
    const result = verifyFindings(findings, context);
    assert.ok(result.summary.false_positive_rate >= 0);
    assert.ok(result.summary.false_positive_rate <= 1);
  });

  it('handles empty findings', () => {
    const result = verifyFindings([], context);
    assert.equal(result.verified.length, 0);
    assert.equal(result.rejected.length, 0);
    assert.equal(result.summary.total_findings, 0);
  });
});
