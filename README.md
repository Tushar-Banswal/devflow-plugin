# DevFlow — Multi-Agent Dev/Review Workflow

> A structured **REVIEWER → DEVELOPER** workflow that brings senior engineering rigour to every coding task.
> Provides a **REVIEWER** (Senior Engineer) and a **DEVELOPER** (Mid-level Engineer) that automatically collaborate through a review loop — catching security issues, architectural violations, and code quality problems before changes are accepted.

> **Current implementation:** Claude Code plugin. Support for GitHub Copilot, Codex, and other coding agents is planned.

---

## How it works

When DevFlow is active, every session follows this workflow:

1. **The orchestrator asks** which model to use for REVIEWER and DEVELOPER (defaults to the active session model)
2. **The orchestrator waits** for your task
3. **REVIEWER** scans the codebase, reads your project rules file (`CLAUDE.md` / `AGENTS.md` / equivalent), asks clarifying questions, then writes a precise implementation brief
4. **DEVELOPER** implements the brief with minimum footprint, self-reviews with the clean-code skill, and reports back
5. **REVIEWER** audits all changes against security, architectural, system-design, and senior-architect checklists — returns **APPROVED** or **REJECTED** with numbered issues
6. Loop continues until approved or until `max_iterations` is reached (default: 5)

---

## Agents

| Agent | Role | Persona |
|-------|------|---------|
| **REVIEWER** | Plans, clarifies, and audits | Senior Engineer — read-only, thinks in systems, security-first |
| **DEVELOPER** | Implements | Mid-level Engineer — minimum footprint, asks before guessing |

---

## Prerequisites

- **Node.js ≥ 18** — required for the activation hook (`hooks/devflow-activate.js`)
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

DevFlow activates automatically on every session start. The orchestrator will:
- Announce that DevFlow is active
- Ask which model to use for each agent (skipped automatically if both are pre-set in config)
- Wait for your task, then run the full REVIEWER → DEVELOPER → REVIEWER loop

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

When both `reviewer_model` and `developer_model` are explicitly set (not `default`), the model-preference prompt is skipped automatically on session start.

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

MIT
