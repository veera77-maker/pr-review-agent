/**
 * Input Validator — sanitizes untrusted webhook payloads.
 * Satisfies INV-3: untrusted input is sanitized before processing.
 */

const REQUIRED_FIELDS = ['pull_request', 'action'];

export function validate(payload) {
  const errors = [];

  if (!payload || typeof payload !== 'object') {
    errors.push('Payload must be a non-null object');
    return { valid: false, errors, sanitized: null };
  }

  for (const field of REQUIRED_FIELDS) {
    if (!(field in payload)) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  if (payload.pull_request) {
    const pr = payload.pull_request;
    if (!pr.title && !pr.body) {
      errors.push('pull_request must have title or body');
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors, sanitized: null };
  }

  const sanitized = sanitize(payload);
  return { valid: true, errors: [], sanitized };
}

function sanitize(payload) {
  const pr = { ...payload.pull_request };

  if (pr.title) pr.title = stripHtml(String(pr.title));
  if (pr.body) pr.body = stripHtml(String(pr.body));

  const files = (pr.files || payload.files || []).map((f) => ({
    filename: String(f.filename || f.name || ''),
    status: String(f.status || 'modified'),
    additions: Number(f.additions) || 0,
    deletions: Number(f.deletions) || 0,
    patch: String(f.patch || ''),
  }));

  const commits = (payload.commits || pr.commits || []).map((c) => ({
    sha: String(c.sha || ''),
    message: String(c.commit?.message || c.message || ''),
    author: String(c.commit?.author?.name || c.author?.login || 'unknown'),
  }));

  return {
    action: String(payload.action),
    pull_request: {
      number: Number(pr.number) || 0,
      title: pr.title || '',
      body: pr.body || '',
      state: String(pr.state || 'open'),
      user: { login: String(pr.user?.login || 'unknown') },
      base: { ref: String(pr.base?.ref || 'main') },
      head: { ref: String(pr.head?.ref || 'feature') },
      html_url: String(pr.html_url || ''),
      changed_files: Number(pr.changed_files) || files.length,
      files,
      commits,
    },
    files,
    commits,
  };
}

function stripHtml(str) {
  return str.replace(/<[^>]*>/g, '').trim();
}
