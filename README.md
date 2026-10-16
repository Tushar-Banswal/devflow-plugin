# DevFlow — Multi-Agent Development and Review

DevFlow adds a structured **REVIEWER → DEVELOPER → REVIEWER** workflow to the AI
coding agent you already use. Install it once at user scope: it activates
automatically in every new session, without a slash command or repository setup.

The REVIEWER plans and audits; the DEVELOPER implements the brief and fixes review
issues. Both run as genuine separate agents. The shared state helper tracks
implementation passes, bounds rejection loops, and binds approval to the reviewed
Git snapshot.

## Integrations and installation

| Host | Automatic activation | Status |
| --- | --- | --- |
| Claude Code | SessionStart hook | Existing integration; shared-runtime regression tests |
| Codex CLI/app | SessionStart hook; one-time user agent registration | Candidate; live verification pending |
| Copilot CLI/VS Code | Native hook and persistent plugin rule | Candidate; live verification pending |
| Antigravity App/CLI | Always-active plugin rule | Candidate; live verification pending |
| Antigravity IDE, hosted/cloud agents | — | Outside this release |

Node.js ≥18 is required. The implementation loop needs Git with an initial commit;
non-Git workspaces support analysis only. Host authentication, model access, trust,
and permission settings remain in control. In particular, Codex requires its
normal one-time hook trust review before plugin hooks run.

See [installation instructions](docs/installation.md) for each host's install,
update, disable, and uninstall flow. Prepare all local packages with:

```sh
npm test
npm run build
```

The generated `dist/` contains independent host packages and local marketplaces.
Public publishing is a separate release action. A host is not fully supported
until actual automatic activation and delegation pass the
[live acceptance procedure](docs/verification.md).

### Existing Claude Code installation

```text
/plugin marketplace add Tushar-Banswal/devflow-plugin
/plugin install devflow@devflow
```

For development from this checkout: `claude --plugin-dir .`.
`/devflow:reviewer [scope]` and `/devflow:developer [instruction]` remain available
for explicit requests. They are not required to activate DevFlow.

## Session behavior

- Each new session gets a brief activation notice once. Activation alone creates
  no workflow, asks for no empty goal, and edits no project files.
- Ordinary questions receive ordinary answers. A development task automatically
  enters the reviewer-led workflow using the task the user supplied.
- An active workflow is recovered before onboarding. Resume and compaction retain
  its goal, brief, issues, configuration, phase, and implementation counter.
- Missing delegation or unsupported model selections stop the implementation loop
  visibly. DevFlow never substitutes role-playing or another model silently.
- Disabling the plugin stops automatic activation. Workflow state remains intact.

## Workflow

1. Read project configuration and recover any active workflow.
2. REVIEWER reads applicable project rules and code, resolves critical ambiguities,
   and writes an implementation brief with acceptance and validation criteria.
3. DEVELOPER implements the brief and applies the clean-code checklist.
4. The orchestrator gathers complete changes and test evidence. REVIEWER audits
   security, architecture, system design, and engineering trade-offs.
5. Record APPROVED or REJECTED. Rejection returns numbered fixes to DEVELOPER;
   reaching `max_iterations` escalates instead of silently extending the loop.

The reviewer has a read/search/web tool allowlist in Claude, Copilot, and
Antigravity. Codex reviewer restrictions are instructions, not a separate sandbox;
Codex subagents inherit parent permissions. Review evidence and project rules are
explicitly passed to each fresh agent. Host-specific details live in `lib/hosts.js`;
the protocol, role sources, checklists, and state engine are shared.

## Optional configuration

No configuration file is required. To customize a project, add root
`devflow.config.json`:

```json
{
  "max_iterations": 5,
  "reviewer_model": "default",
  "developer_model": "default"
}
```

Defaults are five implementation passes and the host's session model for both
roles. Model identifiers are host-specific; non-default selections require a
supported native override. Unsupported choices are reported before implementation.

For compatibility, a flat `devflow:` block in root `CLAUDE.md`, then root
`AGENTS.md`, is still supported:

```yaml
devflow:
  max_iterations: 5
  reviewer_model: default
  developer_model: default
```

Precedence is **JSON → CLAUDE.md → AGENTS.md → defaults**. Select the first
available configuration source as a whole; settings are not merged across files.
JSON must be an object with only the three known keys. The legacy block accepts
two-space indentation, quoted/bare scalars, and comments; it is not general YAML.
Invalid configuration fails visibly. Limits must be positive safe integers.

Configuration is captured when a workflow starts; editing it cannot reset an
active workflow's limit or models. Preset models win independently over onboarding
preferences. Only default entries ask for preferences when starting a task.

## State and recovery

State lives at Git's per-worktree `devflow/state.json` metadata path, outside
commits. One worktree has one active workflow shared across sessions and hosts.
Do not run concurrent orchestrators against it. Linked worktrees are independent.

Run the packaged `hooks/devflow-state.js` from the target project. Each command
takes a JSON object on stdin (`{}` for commands without fields) and returns JSON.
`status` also accepts empty stdin.

| Command | Input | Effect |
| --- | --- | --- |
| `config` | `{}` | Read validated project configuration |
| `status` | `{}` | Read state, null, or stale approval |
| `init` | `goal`, optional model preferences | Begin planning; preserve active workflows |
| `brief` | `brief` | Record the implementation brief |
| `implement` | `{}` | Count and begin one implementation pass |
| `review` | `{}` | Capture the review snapshot |
| `refresh-review` | `{}` | Capture changes and require a complete new review |
| `verdict` | `result`, `summary`, `issues` | Approve, reject, or escalate at the limit |
| `cancel` | `reason` | Cancel only at the user's request |

Verdicts use `APPROVED` with no issues, or `REJECTED` with issue strings in
`file:line — required fix` format. Files changed during review invalidate verdict
submission. Later changes make approval stale. Interrupted implementation resumes
its existing pass without incrementing again.

Writes use a lock and atomic replacement. Conflicting writers fail visibly. After
a crash, confirm no helper remains before removing only `state.json.lock`; preserve
the state file. Never edit state manually to bypass failed transitions.

Approval fingerprints cover HEAD, tracked changes, and non-ignored untracked
files. Ignored files, submodule working-tree contents, and external systems are
outside the fingerprint. DevFlow is an assisted workflow; it does not intercept
every edit, shell command, commit, or merge.

## Development and validation

`npm test` uses Node's dependency-free test runner. `npm run build` generates
relocatable host artifacts from the shared sources; it does not install anything
into the developer's coding agents. GitHub Actions runs tests and packaging on
Node 18, 20, 22, and 24.

See [verification](docs/verification.md) for automated coverage and required live
checks. Generated packages keep `releaseReady: false` until live evidence is
recorded. No fixture result is presented as a live host check.

MIT — see [LICENSE](LICENSE).
