import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { detectBugs } from '../agents/bug-detector.js';

describe('bug-detector', () => {
  const buggyContext = {
    pr_number: 1,
    title: 'Test',
    files: [
      {
        filename: 'bad.js',
        status: 'modified',
        additions: 10,
        deletions: 0,
        patch: '@@ -1,3 +1,10 @@\n+if (x = y) {\n+  console.log(x);\n+}\n+for (let i = 0; i <= arr.length; i++) {\n+  arr[i];\n+}\n+const re = new RegExp(userInput);\n',
      },
    ],
    commits: [],
  };

  const cleanContext = {
    pr_number: 2,
    title: 'Clean',
    files: [
      {
        filename: 'good.js',
        status: 'modified',
        additions: 3,
        deletions: 0,
        patch: '@@ -1,1 +1,3 @@\n+const x = 1;\n+const y = 2;\n+console.log(x + y);\n',
      },
    ],
    commits: [],
  };

  it('detects assignment in condition', () => {
    const result = detectBugs(buggyContext);
    const findings = result.findings || [];
    const assignment = findings.find((f) => f.rule === 'BUG-ASSIGNMENT-CONDITION');
    assert.ok(assignment, 'Should detect assignment in condition');
    assert.equal(assignment.severity, 'critical');
  });

  it('detects off-by-one', () => {
    const result = detectBugs(buggyContext);
    const findings = result.findings || [];
    const offByOne = findings.find((f) => f.rule === 'BUG-OFF-BY-ONE');
    assert.ok(offByOne, 'Should detect off-by-one');
  });

  it('detects unsafe regex', () => {
    const result = detectBugs(buggyContext);
    const findings = result.findings || [];
    const regex = findings.find((f) => f.rule === 'BUG-UNSAFE-REGEX');
    assert.ok(regex, 'Should detect unsafe regex');
  });

  it('returns empty for clean code', () => {
    const result = detectBugs(cleanContext);
    const findings = result.findings || [];
    assert.equal(findings.length, 0);
  });

  it('each finding has required fields', () => {
    const result = detectBugs(buggyContext);
    const findings = result.findings || [];
    for (const f of findings) {
      assert.ok(f.id, 'Finding must have id');
      assert.ok(f.severity, 'Finding must have severity');
      assert.ok(typeof f.confidence === 'number', 'Finding must have confidence');
      assert.ok(f.category, 'Finding must have category');
      assert.ok(f.evidence, 'Finding must have evidence');
      assert.ok(f.impact, 'Finding must have impact');
      assert.ok(f.suggested_fix, 'Finding must have suggested_fix');
    }
  });
});
