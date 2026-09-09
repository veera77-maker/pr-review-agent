/**
 * Finding Merger — deduplicates, ranks, and summarizes findings from all agents.
 * Pure domain logic. Satisfies INV-1.
 */

const SEVERITY_SCORE = { critical: 4, high: 3, medium: 2, low: 1 };

export function mergeFindings(allFindings) {
  const deduped = deduplicate(allFindings);
  const ranked = rankBySeverity(deduped);
  const summary = buildSummary(ranked);

  return {
    findings: ranked,
    summary,
  };
}

function deduplicate(findings) {
  const seen = new Map();
  for (const f of findings) {
    const key = `${f.rule}::${f.file}::${f.line}`;
    if (!seen.has(key)) {
      seen.set(key, f);
    } else {
      const existing = seen.get(key);
      if ((SEVERITY_SCORE[f.severity] || 0) > (SEVERITY_SCORE[existing.severity] || 0)) {
        seen.set(key, f);
      }
    }
  }
  return [...seen.values()];
}

function rankBySeverity(findings) {
  return findings.sort(
    (a, b) => (SEVERITY_SCORE[b.severity] || 0) - (SEVERITY_SCORE[a.severity] || 0)
  );
}

function buildSummary(findings) {
  const bySeverity = {};
  const byCategory = {};
  for (const f of findings) {
    bySeverity[f.severity] = (bySeverity[f.severity] || 0) + 1;
    byCategory[f.category] = (byCategory[f.category] || 0) + 1;
  }

  const maxSeverity = findings.length > 0 ? findings[0].severity : 'none';
  const riskScore = calculateRisk(findings);
  const recommendation = getRecommendation(riskScore, findings);

  return {
    total: findings.length,
    by_severity: bySeverity,
    by_category: byCategory,
    risk_score: riskScore,
    max_severity: maxSeverity,
    recommendation,
  };
}

function calculateRisk(findings) {
  if (findings.length === 0) return 0;
  let score = 0;
  for (const f of findings) {
    score += SEVERITY_SCORE[f.severity] || 0;
  }
  const normalized = Math.min(10, Math.round((score / findings.length) * 2.5));
  return normalized;
}

function getRecommendation(riskScore, findings) {
  const hasCritical = findings.some((f) => f.severity === 'critical');
  if (hasCritical) return 'REQUEST_CHANGES — critical issues must be resolved';
  if (riskScore >= 7) return 'REQUEST_CHANGES — high-risk PR, needs thorough review';
  if (riskScore >= 4) return 'COMMENT — moderate issues found, suggest improvements';
  return 'APPROVE — low risk, minor suggestions';
}
