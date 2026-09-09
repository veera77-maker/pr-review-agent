# KICKOFF — pr-review-agent

## Project Snapshot
- **Name:** pr-review-agent
- **Objective:** Build an AI-powered PR review agent that understands full PR context and produces evidence-based, prioritized findings across 22 review dimensions.
- **Phase:** discovery → prototype (M1-M3), prototype → product (M4-M6)
- **Architecture:** Distributed — multi-agent pipeline with specialized reviewers
- **Trust boundary:** Network-facing (webhooks from GitHub/GitLab/Bitbucket)

## Current State
- `.genesis/` spine initialized
- Cognitive job defined (DONE.html §1)
- 3 invariants registered (context-graph.json)
- Wiki seeded with concept pointers
- Definition of done written (DONE.html §2)
- PLAN.md sliced into 6 milestones with demo commands

## Active Task
- **Milestone:** M1 — Context Builder
- **Goal:** Receive GitHub webhook, build full PR context
- **Demo command:** `curl -X POST localhost:3000/webhook -H 'Content-Type: application/json' -d @test-payload.json && cat output/pr-context.json | jq '.files_changed, .commits, .description'`

## Binding Rules
1. Domain logic never imports framework code (INV-1)
2. Every outbound call has a timeout (INV-2)
3. Untrusted input is sanitized before processing (INV-3)
4. LLM never sees raw secrets — redact before prompting
5. Each milestone must pass its demo command before moving to the next

## Resume Instructions
1. Load this file and PLAN.md
2. Run `genesis query . search|scope|callers|callees|impact PATH` before editing shared code
3. Run `genesis serve .` for a live repo map when structure is unclear
4. Start M1 — build the webhook receiver and context builder
