import { detectBugs } from './src/agents/bug-detector.js';

const cleanPRs = [
  {
    pr_number: 1,
    title: 'Update README',
    files: [
      {
        filename: 'README.md',
        status: 'modified',
        additions: 3,
        deletions: 1,
        patch: '@@ -1,3 +1,5 @@\n+# Project\n+\n-Old description\n+Updated description with more details.\n',
      },
    ],
    commits: [{ sha: 'aaa', message: 'docs: update readme', author: 'dev' }],
  },
  {
    pr_number: 2,
    title: 'Add lint config',
    files: [
      {
        filename: '.eslintrc.json',
        status: 'added',
        additions: 10,
        deletions: 0,
        patch: '@@ -0,0 +1,5 @@\n+{\n+  extends: eslint:recommended,\n+  rules: no-unused-vars warn\n+}\n',
      },
    ],
    commits: [{ sha: 'bbb', message: 'chore: add eslint config', author: 'dev' }],
  },
  {
    pr_number: 3,
    title: 'Fix typo in comment',
    files: [
      {
        filename: 'src/index.js',
        status: 'modified',
        additions: 1,
        deletions: 1,
        patch: '@@ -5,1 +5,1 @@\n-// proces the request\n+// process the request\n',
      },
    ],
    commits: [{ sha: 'ccc', message: 'fix: typo in comment', author: 'dev' }],
  },
  {
    pr_number: 4,
    title: 'Add function docstring',
    files: [
      {
        filename: 'src/utils.js',
        status: 'modified',
        additions: 4,
        deletions: 0,
        patch: '@@ -1,3 +1,7 @@\n+/**\n+ * Calculates sum.\n+ * @param {number} a\n+ */\n export function add(a, b) {\n   return a + b;\n }\n',
      },
    ],
    commits: [{ sha: 'ddd', message: 'docs: add docstring', author: 'dev' }],
  },
  {
    pr_number: 5,
    title: 'Rename variable',
    files: [
      {
        filename: 'src/handler.js',
        status: 'modified',
        additions: 3,
        deletions: 3,
        patch: '@@ -10,3 +10,3 @@\n-const x = getData();\n-const y = x.name;\n-console.log(y);\n+const user = getData();\n+const name = user.name;\n+console.log(name);\n',
      },
    ],
    commits: [{ sha: 'eee', message: 'refactor: rename variable', author: 'dev' }],
  },
];

let totalFindings = 0;
for (const pr of cleanPRs) {
  const result = detectBugs(pr);
  totalFindings += result.findings.length;
  if (result.findings.length > 0) {
    console.log(`False positive in PR #${pr.pr_number}:`, result.findings.map((f) => f.rule));
  }
}

const fpr = totalFindings / cleanPRs.length;
console.log('Total findings on 5 clean PRs:', totalFindings);
console.log('False positive rate:', (fpr * 100).toFixed(1) + '%');
console.log('Pass (< 20%):', fpr < 0.2 ? 'YES' : 'NO');
