/**
 * Markdown Formatter — converts review findings into a PR comment.
 * Pure domain logic. Satisfies INV-1.
 */

const SEVERITY_EMOJI = {
  critical: '🔴',
  high: '🟠',
  medium: '🟡',
  low: '⚪',
};

const SEVERITY_ORDER = ['critical', 'high', 'medium', 'low'];

export function formatReview(review) {
  const lines = [];

  lines.push(`## 🤖 AI Code Review — PR #${review.pr_number}`);
  lines.push('');
  lines.push(`**${review.title}**`);
  lines.push('');

  // Summary box
  lines.push('### Summary');
  lines.push('');
  lines.push(`| Metric | Value |`);
  lines.push(`|--------|-------|`);
  lines.push(`| Risk Score | ${review.summary.risk_score}/10 |`);
  lines.push(`| Total Findings | ${review.summary.total} |`);
  lines.push(`| Recommendation | ${review.summary.recommendation} |`);
  lines.push('');

  // Findings by severity
  for (const severity of SEVERITY_ORDER) {
    const findings = review.findings.filter((f) => f.severity === severity);
    if (findings.length === 0) continue;

    lines.push(`### ${SEVERITY_EMOJI[severity]} ${capitalize(severity)} (${findings.length})`);
    lines.push('');

    for (const f of findings) {
      lines.push(`<details>`);
      lines.push(`<summary><strong>${f.rule}</strong> — <code>${f.file}:${f.line}</code></summary>`);
      lines.push('');
      lines.push(`| Field | Value |`);
      lines.push(`|-------|-------|`);
      lines.push(`| Category | ${f.category} |`);
      lines.push(`| Confidence | ${(f.confidence * 100).toFixed(0)}% |`);
      lines.push(`| Impact | ${f.impact} |`);
      lines.push('');
      lines.push('**Evidence:**');
      lines.push('```');
      lines.push(f.evidence);
      lines.push('```');
      lines.push('');
      lines.push(`**Suggested Fix:** ${f.suggested_fix}`);
      lines.push('');
      lines.push('</details>');
      lines.push('');
    }
  }

  // Category breakdown
  lines.push('### Findings by Category');
  lines.push('');
  lines.push('| Category | Count |');
  lines.push('|----------|-------|');
  for (const [cat, count] of Object.entries(review.summary.by_category)) {
    lines.push(`| ${cat} | ${count} |`);
  }
  lines.push('');

  // Pipeline stats
  lines.push('---');
  lines.push(`*Analyzed by pr-review-agent pipeline in ${review.pipeline.elapsed_ms}ms — ${review.pipeline.total_raw_findings} findings across ${review.pipeline.agents.length} agents*`);

  return lines.join('\n');
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
