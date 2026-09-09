# Wiki — pr-review-agent

Pointers to agentic-swe-kit concept pages relevant to this project.

## Core Concepts

### Architecture
- [Clean Architecture](../../../agentic-swe-kit/wiki/clean-architecture) — Domain/adapters separation, dependency inversion. Applies to: review logic vs. platform adapters (GitHub/GitLab/Bitbucket).

### Distributed Systems
- [Distributed Systems](../../../agentic-swe-kit/wiki/distributed-systems) — Multi-agent coordination, message passing, fault tolerance. Applies to: specialized review agents (Bug, Security, Test, Perf, API, Quality) running in parallel.

### LLM Operations
- [LLMOps & AI Agents](../../../agentic-swe-kit/wiki/llmops-ai-agents) — Agent design patterns, prompt management, evaluation loops. Applies to: LLM-based code understanding, evidence generation, confidence scoring.

### Security
- [Security Engineering](../../../agentic-swe-kit/wiki/security-engineering) — Threat modeling, input validation, secure defaults. Applies to: webhook payload sanitization, secret detection, XSS/injection prevention.

### Delivery
- [Release It!](../../../agentic-swe-kit/wiki/release-it) — Deployment patterns, circuit breakers, health checks. Applies to: CI/CD integration, webhook reliability, graceful degradation.

### Engineering Practice
- [The Pragmatic Programmer](../../../agentic-swe-kit/wiki/pragmatic-programmer) — DRY, orthogonality, tracer bullet. Applies to: finding deduplication, evidence-based reviews, incremental delivery.
- [Designing Data-Intensive Applications](../../../agentic-swe-kit/wiki/designing-data-intensive-applications) — Data flow, consistency, observability. Applies to: PR context aggregation, finding storage, audit trails.
