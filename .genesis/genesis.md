# Genesis — pr-review-agent

## Genesis Output Checklist

After completing the ritual (G0–G6), every box must be true before moving to implementation.

| # | Checkpoint | Status |
|---|-----------|--------|
| 1 | `.genesis/DONE.html` §1 — Cognitive Job filled (scope, AI components, distributed?, trust boundary, phase) | ✅ |
| 2 | `.genesis/DONE.html` §2 — Definition of Done written with exit criteria and demo commands | ✅ |
| 3 | `.genesis/context-graph.json` — 2+ invariants registered with severity | ✅ |
| 4 | `.genesis/wiki/index.md` — Seeded with pointers to concept pages | ✅ |
| 5 | `.genesis/PLAN.md` — Sliced into milestones, each with exact demo command | ✅ |
| 6 | `.genesis/KICKOFF.md` — Filled with project snapshot, current task, binding rules, resume instructions | ✅ |
| 7 | `.genesis/project.json` — Objective, constraints, non-goals recorded | ✅ |
| 8 | All demo commands in PLAN.md are executable (not vague) | ✅ |
| 9 | No existing `.genesis/` was overwritten | ✅ |
| 10 | L4 VERIFY will be run by separate session/model (maker never grades itself) | ⬜ (deferred to build phase) |

## Next Steps

1. Pick milestone **M1 — Context Builder**
2. Run G0 Existence Pre-Flight: is any part already built?
3. Start the BUILD loop: `/goal "M1 done — demo command passes and L4 VERIFY approves"`
4. Every iteration passes 5 gates: G1 Skill, G2 Progress, G3 Cost, G4 Quality, G5 Verify
5. Run L4 VERIFY as a **separate session/model**
