/**
 * Context Builder — pure domain logic.
 * No framework imports. Satisfies INV-1.
 */

export function buildContext(payload) {
  const pr = payload.pull_request || payload;

  const title = String(pr.title || '').trim();
  const description = String(pr.body || '').trim();
  const author = pr.user?.login || 'unknown';
  const baseBranch = pr.base?.ref || 'main';
  const headBranch = pr.head?.ref || 'feature';
  const prNumber = pr.number || 0;
  const url = pr.html_url || '';

  const filesChanged = (payload.pull_request?.changed_files ?? payload.pull_request?.files?.length ?? 0);

  const files = extractFiles(payload);
  const commits = extractCommits(payload);

  return {
    pr_number: prNumber,
    title,
    description,
    author,
    base_branch: baseBranch,
    head_branch: headBranch,
    url,
    files_changed: filesChanged,
    files,
    commits,
  };
}

function extractFiles(payload) {
  const rawFiles = payload.pull_request?.files || payload.files || [];
  return rawFiles.map((f) => ({
    filename: f.filename || f.name || '',
    status: f.status || 'modified',
    additions: f.additions || 0,
    deletions: f.deletions || 0,
    patch: f.patch || '',
  }));
}

function extractCommits(payload) {
  const rawCommits = payload.pull_request?.commits
    ? payload.pull_request.commits
    : payload.commits || [];
  return rawCommits.map((c) => ({
    sha: c.sha || '',
    message: c.commit?.message || c.message || '',
    author: c.commit?.author?.name || c.author?.login || 'unknown',
  }));
}
