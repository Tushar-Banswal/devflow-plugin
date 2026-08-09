# DevFlow — Claude Code Plugin

> **Multi-agent Dev/Review workflow for Claude Code.**
> Provides a **REVIEWER** (Senior Engineer) and a **DEVELOPER** (Mid-level Engineer) that automatically collaborate on every task through a structured review loop.

---

## What it does

When DevFlow is active, every Claude Code session follows this workflow:

1. **Claude asks** which model to use for REVIEWER and DEVELOPER (defaults to the session model)
2. **Claude waits** for your task
3. **REVIEWER** scans the codebase, reads your `CLAUDE.md` / `AGENTS.md`, asks clarifying questions, then writes a precise implementation brief
4. **DEVELOPER** implements the brief with minimum footprint, self-reviews with the clean-code skill, and reports back
5. **REVIEWER** audits all changes against security, architectural, system-design, and senior-architect checklists — returns **APPROVED** or **REJECTED** with numbered issues
6. Loop continues until approved or until `max_iterations` is reached (default: 5)

---

## Installation

### Tier 1 — Self-Hosted (recommended)

Add the marketplace and install the plugin in two commands from within Claude Code:

```shell
/plugin marketplace add Tushar-Banswal/devflow-plugin
/plugin install devflow@devflow
```

If prompted, run:

```shell
/reload-plugins
```

### Dev / Test (one session, no install)

```shell
claude --plugin-dir ./devflow-plugin
```

---

## Usage

### Automatic

DevFlow activates automatically on every session start via the `SessionStart` hook. Claude will:
- Announce that DevFlow is active
- Ask which model to use for each agent
- Wait for your task, then run the full REVIEWER → DEVELOPER → REVIEWER loop

### Manual slash commands

| Command | Effect |
|---------|--------|
| `/devflow:reviewer` | Invoke REVIEWER (codebase scan, clarification, or code review) |
| `/devflow:reviewer [scope]` | REVIEWER focused on specific files or area |
| `/devflow:developer` | Invoke DEVELOPER (implement per REVIEWER's brief) |
| `/devflow:developer [instruction]` | DEVELOPER with additional instruction |

---

## Configuration via CLAUDE.md

Add a `devflow:` block to your project's `CLAUDE.md` to customise behaviour:

```yaml
devflow:
  max_iterations: 5         # Max DEVELOPER → REVIEWER loops (default: 5)
  reviewer_model: default   # Model for REVIEWER ('default' = session model)
  developer_model: default  # Model for DEVELOPER
```

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

The plugin uses the GitHub source pinned in `marketplace.json`. To pull the latest version:

```shell
/plugin marketplace update devflow
```

---

## Validating

Before submitting to the Anthropic community marketplace or distributing to a team:

```shell
claude plugin validate ./devflow-plugin --strict
```

---

## License

MIT
