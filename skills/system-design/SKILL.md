---
name: system-design
description: >
  System design review lens for the REVIEWER. Activate when evaluating changes
  that touch scalability, service interactions, data flows, caching strategies,
  background jobs, or distributed system concerns. Also apply to any database
  query changes or API contract modifications.
---

# System Design Review Lens

---

## Scalability

- [ ] No **single-threaded bottleneck** for tasks that could run concurrently
- [ ] Stateless design preferred — no in-memory state that prevents horizontal scaling
- [ ] Heavy computations are **offloaded** to background jobs / queues, not handled inline in API requests
- [ ] File or object storage used for large data — not stored in the database as BLOBs unnecessarily

---

## Database & Query Quality

- [ ] All new DB queries have appropriate **indexes** for the expected access pattern
- [ ] No **N+1 query patterns** — batch or eager-load related data
- [ ] **Pagination** applied on any list endpoint that could return unbounded results
- [ ] Transactions used correctly — operations that must be atomic are wrapped in a transaction
- [ ] No schema migrations that lock tables in production without a rollback plan

---

## Data Flow

- [ ] Data transformations are **predictable and traceable** — no implicit mutations
- [ ] Inputs and outputs of each layer are clearly typed
- [ ] Data access patterns match the read/write ratio of the endpoint (e.g., use read replicas for heavy reads if the project uses them)

---

## Reliability

- [ ] All external API / service calls have **timeouts** configured
- [ ] **Retry logic** with exponential backoff and jitter applied to transient failures (network, rate limits)
- [ ] Graceful degradation when a non-critical external dependency is unavailable
- [ ] Idempotency considered for operations that may be retried (especially webhooks, payment callbacks)
- [ ] Circuit breaker or fallback strategy for critical external dependencies

---

## Caching

- [ ] Cache invalidation strategy is defined — not just "cache it and hope"
- [ ] Cache keys are namespaced to avoid collisions
- [ ] Sensitive or user-specific data is not cached in a shared cache without isolation
- [ ] TTL is set appropriately for the data's staleness tolerance

---

## Observability

- [ ] New code paths emit **structured logs** (not ad-hoc `console.log`) with enough context to debug in production
- [ ] Critical operations emit **metrics or audit events** (e.g., payment processed, user created)
- [ ] Errors include enough context (request ID, user scope, operation name) to reproduce in production

---

## API Contract

- [ ] No **breaking changes** to existing public API contracts without versioning
- [ ] New endpoints follow the existing API conventions (naming, HTTP verbs, error formats)
- [ ] Response shapes are documented and typed

---

## Trade-off Documentation

- [ ] Significant design trade-offs noted in code comments or CLAUDE.md
- [ ] Performance vs consistency trade-offs explicitly acknowledged
- [ ] Any eventual consistency decision documented with rationale
