/**
 * GitHub Client — posts PR comments via GitHub REST API.
 * Adapter layer. Uses fetch (built-in, INV-2 timeout enforced).
 * Satisfies INV-1 (adapters implement domain interfaces).
 */

const GITHUB_API = 'https://api.github.com';

export class GitHubClient {
  constructor({ token, timeout = 30000 } = {}) {
    this.token = token || process.env.GITHUB_TOKEN;
    this.timeout = timeout;
  }

  async postPRComment(owner, repo, prNumber, body) {
    const url = `${GITHUB_API}/repos/${owner}/${repo}/issues/${prNumber}/comments`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.token}`,
          Accept: 'application/vnd.github+json',
        },
        body: JSON.stringify({ body }),
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (res.status === 403) {
        const reset = res.headers.get('x-ratelimit-reset');
        const retryAfter = reset
          ? Math.max(0, Number(reset) * 1000 - Date.now())
          : 60000;
        return {
          ok: false,
          error: 'rate_limited',
          retryAfter,
          status: res.status,
        };
      }

      if (!res.ok) {
        const text = await res.text();
        return {
          ok: false,
          error: `GitHub API error ${res.status}: ${text}`,
          status: res.status,
        };
      }

      const data = await res.json();
      return { ok: true, comment_id: data.id, html_url: data.html_url };
    } catch (err) {
      clearTimeout(timer);
      if (err.name === 'AbortError') {
        return { ok: false, error: `Request timed out after ${this.timeout}ms` };
      }
      return { ok: false, error: err.message };
    }
  }

  async getPRComments(owner, repo, prNumber) {
    const url = `${GITHUB_API}/repos/${owner}/${repo}/issues/${prNumber}/comments`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);

    try {
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${this.token}`,
          Accept: 'application/vnd.github+json',
        },
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!res.ok) {
        return { ok: false, error: `GitHub API error ${res.status}` };
      }

      const data = await res.json();
      return { ok: true, comments: data };
    } catch (err) {
      clearTimeout(timer);
      return { ok: false, error: err.message };
    }
  }
}
