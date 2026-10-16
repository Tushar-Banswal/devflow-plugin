---
name: developer
description: Explicitly delegate to the DevFlow DEVELOPER agent using the tracked workflow.
disable-model-invocation: true
---

# Delegate to DEVELOPER

User scope or instruction: $ARGUMENTS

Read `${CLAUDE_SKILL_DIR}/../../lib/workflow.md` and follow its protocol as the
ORCHESTRATOR. Replace `__DEVFLOW_STATE_COMMAND__` with
`node "${CLAUDE_SKILL_DIR}/../../hooks/devflow-state.js"` when running helper commands.

Use the Agent tool with `subagent_type: devflow:developer`. Do not perform the
developer's work in the main conversation. Pass the full goal, brief, current phase,
previous issues, relevant decisions and the resolved model from workflow state.

Require a recorded REVIEWER brief before implementation. If none exists, delegate
planning to `devflow:reviewer` first; never offer to bypass review. Run `implement`
before a new pass, then delegate implementation. Continue through validation and
REVIEWER's recorded verdict, respecting rejection and iteration exhaustion.
