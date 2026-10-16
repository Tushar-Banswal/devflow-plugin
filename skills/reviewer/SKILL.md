---
name: reviewer
description: Explicitly delegate to the DevFlow REVIEWER agent using the tracked workflow.
disable-model-invocation: true
---

# Delegate to REVIEWER

User scope or instruction: $ARGUMENTS

The shared protocol is `${CLAUDE_SKILL_DIR}/../../lib/workflow.md`.
Render it with its Claude adapter using
`node "${CLAUDE_SKILL_DIR}/../../bin/devflow.js" context --host claude-code`
with JSON {} on stdin, from the target project. Follow the returned protocol as
the ORCHESTRATOR. It resolves the installed state helper's absolute path.

Use the Agent tool with `subagent_type: devflow:reviewer`. Do not perform the
reviewer's work in the main conversation. Pass the full goal, brief, current phase,
previous issues, relevant decisions and the resolved model from workflow state.

For analysis-only requests, delegate analysis directly without initializing an
implementation workflow. Supply Git history/diffs and available test evidence;
collect missing context for the read-only reviewer. For implementation requests,
complete planning before recording a brief. For a post-implementation review,
record the snapshot before delegation and submit the returned JSON verdict.
