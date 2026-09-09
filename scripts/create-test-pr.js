const token = process.env.GITHUB_TOKEN;
if (!token) { console.error('Set GITHUB_TOKEN env var'); process.exit(1); }
const h = { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' };

(async () => {
  // 1. Create file with intentional bugs
  const fileContent = Buffer.from(`export function getUser(id) {
  const row = db.query('SELECT * FROM users WHERE id = ' + id);
  if (row = null) {
    return null;
  }
  for (let i = 0; i <= users.length; i++) {
    console.log(users[i]);
  }
  const regex = new RegExp(userInput);
  return { name: row.name, email: row.email };
}

export function parseConfig(raw) {
  return JSON.parse(raw);
  // TODO: add validation
}
`).toString('base64');

  const fileRes = await fetch('https://api.github.com/repos/veera77-maker/ai-engineering/contents/src/utils.js', {
    method: 'PUT', headers: h,
    body: JSON.stringify({
      message: 'feat: add user utils',
      content: fileContent,
      branch: 'test-pr-review'
    })
  });
  const fd = await fileRes.json();
  console.log('File:', fd.content?.name || fd.message);

  // 2. Create PR
  const prRes = await fetch('https://api.github.com/repos/veera77-maker/ai-engineering/pulls', {
    method: 'POST', headers: h,
    body: JSON.stringify({
      title: 'feat: add user utilities (demo)',
      body: 'Adds user utility functions for querying and parsing configuration. Contains intentional bugs for review agent demo.',
      head: 'test-pr-review',
      base: 'main'
    })
  });
  const pr = await prRes.json();
  console.log('PR #' + pr.number + ': ' + pr.title);
  console.log('URL: ' + pr.html_url);
})();
