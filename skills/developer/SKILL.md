---
name: developer
description: Explicitly delegate to the PatchDuo DEVELOPER agent using the tracked workflow.
disable-model-invocation: true
---

# Delegate to DEVELOPER

User scope or instruction: $ARGUMENTS

The shared protocol is `${CLAUDE_SKILL_DIR}/../../lib/workflow.md`.
Render it with its Claude adapter using
`node "${CLAUDE_SKILL_DIR}/../../bin/patchduo.js" context --host claude-code`
with JSON {} on stdin, from the target project. Follow the returned protocol as
the ORCHESTRATOR. It resolves the installed state helper's absolute path.

Use the Agent tool with `subagent_type: patchduo:developer`. Do not perform the
developer's work in the main conversation. Pass the full goal, brief, current phase,
previous issues, relevant decisions and the resolved model from workflow state.

Require a recorded REVIEWER brief before implementation. If none exists, delegate
planning to `patchduo:reviewer` first; never offer to bypass review. Run `implement`
before a new pass, then delegate implementation. Continue through validation and
REVIEWER's recorded verdict, respecting rejection and iteration exhaustion.
