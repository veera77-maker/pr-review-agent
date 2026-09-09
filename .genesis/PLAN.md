# PLAN — pr-review-agent

## Milestones

### M1 — Context Builder
**Goal:** Receive a GitHub webhook and build full PR context (title, description, changed files, surrounding code, tests, repo structure).

**Demo command:**
```bash
curl -X POST localhost:3000/webhook -H 'Content-Type: application/json' -d @test-payload.json && cat output/pr-context.json | jq '.files_changed, .commits, .description'
```

**Exit criteria:**
- Webhook endpoint accepts POST and validates payload schema
- Fetches PR diff from GitHub API
- Extracts surrounding code (±20 lines) for each changed file
- Identifies test files related to changed code
- Output: structured JSON with all context fields

---

### M2 — Single Review Agent (Bug Detection)
**Goal:** One specialized agent that analyzes PR context and produces bug findings with evidence.

**Demo command:**
```bash
node src/agents/bug-detector.js --input output/pr-context.json | jq '.findings[] | {severity, confidence, evidence, fix}'
```

**Exit criteria:**
- Agent accepts PR context JSON
- Detects at least: null handling, incorrect conditions, off-by-one, exception handling
- Each finding has severity, confidence, evidence (file:line), impact, suggested fix
- False positive rate < 20% on 5 test PRs

---

### M3 — Multi-Agent Pipeline
**Goal:** All 6 specialized agents (Bug, Security, Test, Perf, API, Quality) run in parallel and findings are merged/deduplicated.

**Demo command:**
```bash
node src/pipeline/run.js --pr output/pr-context.json | jq '.summary.risk, .findings | length, .findings | group_by(.category) | map({category: .[0].category, count: length})'
```

**Exit criteria:**
- 6 agents run concurrently (Promise.all or worker threads)
- Finding Merger deduplicates across agents
- Output includes PR-level summary: risk score, finding count by category, recommendation
- Pipeline completes in < 60s for a 20-file PR

---

### M4 — GitHub Integration
**Goal:** Post review findings as PR comment on GitHub.

**Demo command:**
```bash
node src/integration/post-review.js --pr-number 42 --review output/pr-42-review.md && echo "Comment posted: $(gh pr view 42 --json comments | jq '.comments | length')"
```

**Exit criteria:**
- Authenticates with GitHub token
- Formats findings as markdown comment
- Posts comment to correct PR
- Handles rate limits gracefully

---

### M5 — Evidence Verification Loop
**Goal:** For each finding, verify it against codebase context before publishing (reduce false positives).

**Demo command:**
```bash
node src/verify/run.js --findings output/pr-42.json --context output/pr-context.json | jq '.verified | length, .rejected | length, .false_positive_rate'
```

**Exit criteria:**
- For each finding, searches callers/callees to confirm it's real
- Rejects findings where code context invalidates the claim
- False positive rate drops below 10%
- Verification completes in < 30s per finding

---

### M6 — Production Hardening
**Goal:** Timeouts, rate limiting, graceful degradation, monitoring.

**Demo command:**
```bash
npm test -- --coverage && npm run lint && echo "All gates pass"
```

**Exit criteria:**
- All outbound calls have explicit timeouts (grep confirms)
- Rate limiter on LLM API calls
- Queue + retry when LLM is unavailable
- Health check endpoint returns 200
- Test coverage ≥ 80%
- Lint passes with zero warnings
