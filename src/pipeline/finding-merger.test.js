import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mergeFindings } from '../pipeline/finding-merger.js';

describe('finding-merger', () => {
  const findings = [
    { id: '1', rule: 'R1', severity: 'high', confidence: 0.8, category: 'cat1', file: 'a.js', line: 1, evidence: 'e1', impact: 'i1', suggested_fix: 'f1' },
    { id: '2', rule: 'R1', severity: 'high', confidence: 0.8, category: 'cat1', file: 'a.js', line: 1, evidence: 'e2', impact: 'i2', suggested_fix: 'f2' },
    { id: '3', rule: 'R2', severity: 'critical', confidence: 0.9, category: 'cat2', file: 'b.js', line: 5, evidence: 'e3', impact: 'i3', suggested_fix: 'f3' },
  ];

  it('deduplicates same rule+file+line', () => {
    const result = mergeFindings(findings);
    assert.equal(result.findings.length, 2, 'Should deduplicate to 2');
  });

  it('ranks by severity', () => {
    const result = mergeFindings(findings);
    assert.equal(result.findings[0].severity, 'critical');
  });

  it('builds summary with risk score', () => {
    const result = mergeFindings(findings);
    assert.ok(typeof result.summary.risk_score === 'number');
    assert.ok(result.summary.recommendation);
  });

  it('handles empty findings', () => {
    const result = mergeFindings([]);
    assert.equal(result.findings.length, 0);
    assert.equal(result.summary.risk_score, 0);
  });
});
