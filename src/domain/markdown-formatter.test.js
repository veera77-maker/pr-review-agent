import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatReview } from '../domain/markdown-formatter.js';

describe('markdown-formatter', () => {
  const review = {
    pr_number: 42,
    title: 'Test PR',
    findings: [
      {
        id: 'BUG-1',
        rule: 'BUG-TEST',
        severity: 'high',
        confidence: 0.8,
        category: 'test_category',
        file: 'test.js',
        line: 1,
        evidence: 'test evidence',
        impact: 'test impact',
        suggested_fix: 'test fix',
      },
    ],
    summary: {
      total: 1,
      risk_score: 5,
      recommendation: 'COMMENT',
      by_category: { test_category: 1 },
    },
    pipeline: { elapsed_ms: 10, total_raw_findings: 1, agents: [{ agent: 'test' }] },
  };

  it('produces markdown with PR number', () => {
    const md = formatReview(review);
    assert.ok(md.includes('PR #42'));
  });

  it('includes summary table', () => {
    const md = formatReview(review);
    assert.ok(md.includes('Risk Score'));
    assert.ok(md.includes('5/10'));
  });

  it('includes findings by severity', () => {
    const md = formatReview(review);
    assert.ok(md.includes('High'));
    assert.ok(md.includes('BUG-TEST'));
  });

  it('includes category breakdown', () => {
    const md = formatReview(review);
    assert.ok(md.includes('test_category'));
  });

  it('handles empty findings', () => {
    const emptyReview = { ...review, findings: [], summary: { ...review.summary, total: 0, by_category: {} } };
    const md = formatReview(emptyReview);
    assert.ok(md.includes('PR #42'));
  });
});
