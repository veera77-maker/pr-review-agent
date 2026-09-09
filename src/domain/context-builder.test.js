import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildContext } from '../domain/context-builder.js';

describe('context-builder', () => {
  const samplePayload = {
    action: 'opened',
    pull_request: {
      number: 42,
      title: 'Test PR',
      body: 'Description here',
      state: 'open',
      user: { login: 'dev' },
      base: { ref: 'main' },
      head: { ref: 'feature' },
      html_url: 'https://github.com/test/repo/pull/42',
      changed_files: 2,
      files: [
        { filename: 'a.js', status: 'modified', additions: 5, deletions: 2, patch: '+line' },
      ],
      commits: [
        { sha: 'abc123', message: 'commit msg', author: { name: 'dev' } },
      ],
    },
  };

  it('extracts basic PR fields', () => {
    const ctx = buildContext(samplePayload);
    assert.equal(ctx.pr_number, 42);
    assert.equal(ctx.title, 'Test PR');
    assert.equal(ctx.description, 'Description here');
    assert.equal(ctx.author, 'dev');
    assert.equal(ctx.base_branch, 'main');
    assert.equal(ctx.head_branch, 'feature');
  });

  it('extracts files', () => {
    const ctx = buildContext(samplePayload);
    assert.equal(ctx.files.length, 1);
    assert.equal(ctx.files[0].filename, 'a.js');
  });

  it('extracts commits', () => {
    const ctx = buildContext(samplePayload);
    assert.equal(ctx.commits.length, 1);
    assert.equal(ctx.commits[0].sha, 'abc123');
  });

  it('handles missing fields gracefully', () => {
    const ctx = buildContext({ pull_request: {} });
    assert.equal(ctx.title, '');
    assert.equal(ctx.author, 'unknown');
    assert.equal(ctx.files.length, 0);
  });

  it('counts changed_files from payload', () => {
    const ctx = buildContext(samplePayload);
    assert.equal(ctx.files_changed, 2);
  });
});
