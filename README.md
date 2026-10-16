# DevFlow — Multi-Agent Dev/Review Workflow

> A structured **REVIEWER → DEVELOPER** workflow that brings senior engineering rigour to every coding task.
> Provides a **REVIEWER** (Senior Engineer) and a **DEVELOPER** (Mid-level Engineer) that collaborate through an assisted review loop to identify security, architecture, and code quality issues.

> **Current implementation:** Claude Code plugin. Support for GitHub Copilot, Codex, and other coding agents is planned.

---

## How it works

When DevFlow is active, the orchestrator follows this workflow:

1. **The orchestrator reads configuration**, restores any active workflow, and asks model preferences only for unset/default entries
2. **The orchestrator uses your supplied task**, asking for a goal only when needed
3. **REVIEWER** scans the codebase, reads your project rules file (`CLAUDE.md` / `AGENTS.md` / equivalent), asks clarifying questions, then writes a precise implementation brief
4. **DEVELOPER** implements the brief with minimum footprint, self-reviews with the clean-code skill, and reports back
5. **REVIEWER** audits all changes against security, architectural, system-design, and senior-architect checklists — returns **APPROVED** or **REJECTED** with numbered issues
6. A persistent workflow helper validates transitions, counts implementation passes, and stops rejection loops at `max_iterations` (default: 5)

The helper binds approval to HEAD, tracked changes, and non-ignored untracked
files. Later changes make approval stale. The orchestrator must invoke the helper
and agents correctly; DevFlow does not intercept every edit, command, commit or
merge and is not a repository-wide enforcement gate. Ignored files, submodule
working-tree contents, and external systems are outside the approval fingerprint.

---

## Agents

| Agent | Role | Persona |
|-------|------|---------|
| **REVIEWER** | Plans, clarifies, and audits | Senior Engineer — read-only, thinks in systems, security-first |
| **DEVELOPER** | Implements | Mid-level Engineer — minimum footprint, asks before guessing |

---

## Prerequisites

- **Node.js ≥ 18** — required for activation and workflow state
- **Git with an initial commit** — required for the tracked implementation loop; non-Git projects support analysis only
- **Claude Code** — the plugin runs inside Claude Code sessions

---

## Installation

### Claude Code (current)

Add the marketplace and install the plugin in two commands from within Claude Code:

```shell
/plugin marketplace add Tushar-Banswal/devflow-plugin
/plugin install devflow@devflow
```

If prompted, run:

```shell
/reload-plugins
```

#### Dev / Test (one session, no install)

Run this from the **parent directory** of `devflow-plugin/`:

```shell
claude --plugin-dir ./devflow-plugin
```

### GitHub Copilot / Codex *(coming soon)*

Support for additional coding agents is planned. Watch this repo for updates.

---

## Usage

### Automatic activation

DevFlow loads on startup, resume, clear, and compaction. On a fresh workflow it
announces activation, reads configuration, and resolves model preferences. Resume
and compaction restore the recorded phase, brief, issues and iteration without
repeating onboarding. An existing task is used immediately.

Both manual commands explicitly delegate through the Agent tool to the scoped
`devflow:reviewer` and `devflow:developer` agents. The reviewer has only Read, Grep,
Glob and WebSearch: the orchestrator supplies Git history, diffs and test evidence.
Plugin agents omit unsupported `permissionMode` fields. The developer command
requires a reviewer brief and continues through validation and review.

### Manual invocation

| Command | Effect |
|---------|--------|
| `/devflow:reviewer` | Invoke REVIEWER (codebase scan, clarification, or code review) |
| `/devflow:reviewer [scope]` | REVIEWER focused on specific files or area |
| `/devflow:developer` | Invoke DEVELOPER (implement per REVIEWER's brief) |
| `/devflow:developer [instruction]` | DEVELOPER with additional instruction |

---

## Configuration

Add a `devflow:` block inside your project's `CLAUDE.md` or `AGENTS.md` file to customise behaviour:

```yaml
devflow:
  max_iterations: 5         # Max DEVELOPER → REVIEWER loops (default: 5)
  reviewer_model: default   # Model for REVIEWER ('default' = session model)
  developer_model: default  # Model for DEVELOPER
```

The supported configuration is a flat block with two-space indentation, bare or
quoted scalar values, and optional comments, as shown above. `max_iterations`
must be a positive safe integer; duplicate/unknown keys and malformed values fail
visibly. This is a deliberately limited parser, not a general YAML loader.

The first block found in root `CLAUDE.md`, then root `AGENTS.md`, wins as a whole.
Each explicitly set model takes precedence independently. Only entries set to
`default` prompt for a preference; leaving one at default inherits the session
model. The orchestrator passes non-default choices explicitly during delegation.
If the installed Agent tool cannot honor a choice, it must report the limitation
before proceeding. Host model restrictions still apply.

Configuration is captured when a workflow starts. Editing it during an active
workflow does not reset that workflow's iteration limit or selected models.

---

## Skills included

| Skill | Used by | Purpose |
|-------|---------|---------|
| `devflow:clean-code` | DEVELOPER | Self-review checklist after every implementation |
| `devflow:security` | REVIEWER | OWASP-aligned security audit (auth, injection, secrets, data handling) |
| `devflow:architectural` | REVIEWER | SOLID, dependency direction, coupling, layer separation |
| `devflow:system-design` | REVIEWER | Scalability, DB quality, reliability, caching, observability |
| `devflow:senior-architect` | REVIEWER | Trade-off analysis, blast radius, final APPROVE/REJECT gate |

---

## Workflow state and recovery

State lives at Git's per-worktree `devflow/state.json` path under its Git metadata,
so it stays out of commits and linked worktrees have independent state. Run one
workflow per worktree; sessions in the same worktree share the active goal.
State contains the goal, brief, models, iteration and latest review issues. The
orchestrator passes that context to every new agent, which has no conversation
history by default.

The helper is `hooks/devflow-state.js`. Run it from the target project with a
command argument and a JSON object on stdin; output is JSON. Use `{}` when no
input fields are needed. For example, from this plugin checkout:

```sh
node hooks/devflow-state.js status < /dev/null
```

| Command | Input | Result |
|---------|-------|--------|
| `config` | `{}` | Validated project configuration |
| `status` | `{}` | Recorded state, `null`, or stale approval |
| `init` | `goal`, optional model preferences | Starts planning; refuses to reset an active workflow |
| `brief` | `brief` | Records the implementation brief |
| `implement` | `{}` | Starts and counts one implementation pass |
| `review` | `{}` | Captures the current changes for review |
| `refresh-review` | `{}` | Captures changed files; requires a fresh complete review |
| `verdict` | `result`, `summary`, `issues` | Approves, rejects, or escalates at the limit |
| `cancel` | `reason` | Cancels an active workflow at the user's request |

Verdicts must be `APPROVED` with no issues, or `REJECTED` with issue strings in
`file:line — required fix` format. Files changed during review cause verdict
submission to fail. Approval becomes stale when the fingerprint changes later.

Writes use a lock and atomic replacement. A conflicting writer fails visibly.
If a process crashes while holding the lock, confirm no helper process remains
before removing only `state.json.lock` beside the state file; preserve the state.
An interrupted implementation resumes its existing pass without incrementing.

## Testing

```sh
npm test
```

The dependency-free Node test runner exercises configuration, persistent state,
rejection/fix loops, iteration exhaustion, malformed verdicts, changed snapshots,
session recovery, worktree isolation, lock conflicts and packaging. GitHub Actions
runs these checks on Node 18, 20, 22 and 24.

These tests do not run a live Claude session. Follow
[`__test__/expected_output.txt`](__test__/expected_output.txt) for the manual
integration scenarios, including actual delegation and model selection.

## Updating

To pull the latest version:

```shell
/plugin marketplace update devflow
```

---

## Roadmap

- [x] Claude Code plugin
- [ ] GitHub Copilot integration
- [ ] Codex / OpenAI Codex CLI integration
- [ ] Configurable agent personas
- [ ] Custom skill support via project rules file

---

## License

MIT — see [LICENSE](LICENSE).
