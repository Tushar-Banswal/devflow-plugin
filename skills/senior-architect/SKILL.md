---
name: senior-architect
description: >
  Senior Architect meta-framework for the REVIEWER. Activate as the holistic
  decision lens for any major change, new pattern, or cross-cutting concern.
  Guides trade-off analysis, farsighted thinking, blast-radius assessment, and
  the final APPROVE / REJECT call after all other review skills have run.
---

# Senior Architect Decision Framework

This skill runs last — after security, architectural, and system-design checklists.
It synthesises findings and applies farsighted judgment to the final verdict.

---

## Before Starting Review — Context Check

1. **Understand the full intent** — What problem does this change solve? Is it solving the right problem?
2. **Identify the blast radius** — What breaks if this has a bug? Which downstream systems are affected?
3. **Check reversibility** — Can this be reverted with a one-line config change? Or is it irreversible (schema migration, data transform, API contract)?
4. **Verify scope** — Does the implementation match the REVIEWER's brief, or has scope crept in?

---

## Trade-off Analysis

For every significant design decision visible in the code, complete this table:

| Dimension | Chosen Approach | Alternative | Why This Was Chosen |
|-----------|----------------|-------------|---------------------|
| Performance | ... | ... | ... |
| Maintainability | ... | ... | ... |
| Security | ... | ... | ... |
| Complexity | ... | ... | ... |
| Operational cost | ... | ... | ... |

If the DEVELOPER made a decision that isn't justified by the trade-off, flag it.

---

## Farsighted Questions

Ask these before writing the verdict:

- **Readability in 6 months**: Will a developer who has never seen this code understand it quickly?
- **Changeability**: Does this make the next similar change easier or harder?
- **Problem framing**: Are we solving the root cause, or papering over a symptom?
- **Hidden coupling**: Does this create implicit dependencies that will cause pain later?
- **Operational confidence**: Would you be comfortable being on-call when this deploys?
- **Test coverage**: Is the change testable? Are the critical paths covered?

---

## Final Approval Criteria

**APPROVE** only when ALL of the following are true:

| Criterion | Check |
|-----------|-------|
| `devflow:security` — no blocking issues | ✅ / ✗ |
| `devflow:architectural` — no violations | ✅ / ✗ |
| `devflow:system-design` — no scalability red flags | ✅ / ✗ |
| CLAUDE.md / AGENTS.md project rules — fully compliant | ✅ / ✗ |
| `devflow:clean-code` — DEVELOPER self-review applied | ✅ / ✗ |
| Minimum change principle — no scope creep | ✅ / ✗ |
| All clarifying questions answered before implementation | ✅ / ✗ |
| Trade-off decisions are justified | ✅ / ✗ |

If ANY row is ✗ → **REJECTED**. List every failing item with file + line + required fix.

---

## Escalation (Max Iterations Reached)

If the REVIEWER has not been able to APPROVE after the configured max iterations:

1. Stop the loop.
2. Present the user with:
   - A list of remaining blockers (specific, file-referenced)
   - The REVIEWER's recommendation for next steps
   - Options: (a) relax a constraint, (b) redesign the approach, (c) manual fix
3. Ask the user how to proceed.

Do NOT silently approve a failed implementation to exit the loop.
