# Install once, activate every session

PatchDuo extends the coding agent you already use. It uses that host's existing
login, models, permissions, and tools. Node.js 18+ must be available to hooks.
The tracked implementation loop also requires Git and an initial commit.

No target repository setup is required. `patchduo.config.json` is optional.
Install at **user scope** and leave the plugin enabled. Host policies that block
plugins/hooks/delegation still apply; PatchDuo never bypasses them.

The new host packages are unverified candidates until the live acceptance checks
in [verification.md](verification.md) pass. The commands below prepare local
installation/testing; nothing has been published to a public marketplace.

## Prepare distributable packages

From the source checkout:

```sh
npm test
npm run build
```

`dist/` is a self-contained distribution with `claude-code/`, `codex/`, `copilot/`,
and `antigravity/` packages plus host-specific local marketplace catalogs. You can
move or distribute the entire directory. The runtime does not reference the source
checkout. Keep the distribution available if a local marketplace loads it in place.

## Claude Code

Existing marketplace installation is preserved:

```text
/plugin marketplace add Tushar-Banswal/patchDuo
/plugin install patchduo@patchduo
```

For the generated local release, register the absolute path to `dist/` and install
`patchduo@patchduo-claude-code`. For one-session development, run:

```sh
claude --plugin-dir /absolute/path/to/dist/claude-code
```

The SessionStart hook handles startup, resume, clear, and compaction. The existing
`/patchduo:reviewer` and `/patchduo:developer` commands remain available but are not
required for activation. Use the plugin manager to update, disable, or uninstall.

## Codex CLI and app

Register the local marketplace and install its plugin:

```sh
codex plugin marketplace add /absolute/path/to/dist
codex plugin add patchduo@patchduo-codex
node /absolute/path/to/dist/codex/bin/patchduo.js setup --host codex
```

For app installation, open the registered PatchDuo marketplace in the plugin
browser and install PatchDuo. Run the same one-time setup command: Codex discovers
custom agent profiles from the user's agent directory, separately from plugins.
Setup honors the active `CODEX_HOME`, otherwise `~/.codex`. It installs only
`agents/patchduo-reviewer.toml`, `agents/patchduo-developer.toml`, and ownership data
under `patchduo/`. It does not modify config.toml, hooks, project instructions,
authentication, or permission settings.

**One-time hook trust:** Codex requires review/trust of non-managed plugin hooks.
Open `/hooks` and trust the PatchDuo definition before testing a fresh session.
Installing/enabling a plugin alone does not grant this trust. Changed hooks after
an update may need another trust review. There is no per-session PatchDuo command
once setup and the host's trust review are complete.

Use the app plugin controls to disable/enable. CLI removal is:

```sh
codex plugin remove patchduo@patchduo-codex
node /absolute/path/to/dist/codex/bin/patchduo.js uninstall --host codex
```

Use `--dry-run` on setup/uninstall to preview profile changes. Setup is idempotent;
rerun it from an updated release to update owned profiles. User-modified or
unowned profiles cause a visible conflict, with no profile changes. Preserve your
edits before resolving that conflict. Native plugin uninstall does not run custom
cleanup, so the second command removes the separately registered profiles.
If setup crashes leaving `patchduo/registration.lock`, first confirm no setup
process remains, then remove only that lock and retry; preserve ownership data.

The reviewer follows read-only instructions but inherits parent permissions.
PatchDuo does not claim a separate Codex read-only sandbox. Non-default model
choices require a supported native spawn override; unsupported overrides stop the
workflow rather than silently using another model.

## Copilot CLI and VS Code

Install the generated package at user scope:

```sh
copilot plugin install /absolute/path/to/dist/copilot
```

Alternatively, register `dist/` as a Copilot marketplace and install
`patchduo@patchduo-copilot`. In VS Code's Copilot harness, use `/plugin install` with
the same source or the plugin browser. The package also supplies a Local-harness
compatible SessionStart hook response. Local harness hooks require the host's
hook feature and workspace trust; managed policy can disallow them.

The package contains an automatic SessionStart hook, a persistent activation rule,
and native `patchduo-reviewer` / `patchduo-developer` agents. The rule restores the
protocol if compaction removed it. Namespace-qualified display names can vary by
host; the orchestrator uses the loaded agent inventory.

Use native plugin update/enable/disable/uninstall commands or the VS Code plugin
controls. Disabling the plugin disables its automatic activation components.

## Antigravity App and CLI

Install the generated package, or select its folder in App Customizations:

```sh
agy plugin validate /absolute/path/to/dist/antigravity
agy plugin install /absolute/path/to/dist/antigravity
```

The plugin's `always_on` rule activates PatchDuo on the first model invocation of
every main-agent session. It loads the bundled protocol and current project state
automatically; the user does not invoke a skill. It avoids assumptions about a
plugin-relative shell working directory or undocumented root environment variables.
The rule also restores the protocol after compaction without repeating onboarding.

Use `agy plugin enable patchduo`, `agy plugin disable patchduo`, and
`agy plugin uninstall patchduo`, or the App's plugin controls. For a local update,
install the new package through the native plugin manager. Antigravity IDE remains
outside the advertised targets until separate-agent delegation is verified.

## Upgrade from DevFlow

The project and repository are now PatchDuo. Use `Tushar-Banswal/patchDuo` for
GitHub links and marketplace registration. Install the new
`patchduo` plugin and disable/uninstall the old `devflow` plugin so only one
orchestrator runs. Agent names and manual commands now use `patchduo`.

Existing `devflow.config.json` and `devflow:` blocks are accepted. The new JSON
filename takes priority over the old one; each rules file prefers its `patchduo:`
block over `devflow:`. Workflow metadata remains at Git's `devflow/state.json`
path so tasks continue without resetting counters or the starting commit.

Codex profiles have new names and separate ownership records. Before removing the
old package, run its `node bin/devflow.js uninstall --host codex` to clean up
unchanged DevFlow-owned profiles. Then run the new package's setup command. New
PatchDuo setup/uninstall never removes the separately owned DevFlow profiles.

## Across all hosts

On a new session, PatchDuo announces activation once, recovers active workflow
state, and waits for a task if none was supplied. Ordinary questions do not start
an implementation loop. Development tasks automatically enter reviewer planning,
implementation, validation, and review. A resumed/compacted conversation continues
without repeating onboarding or resetting the iteration counter.

Defaults inherit each host's session model. A preset model identifier must be
valid for that host. If native delegation or a requested model override is
unavailable, PatchDuo stops before implementation and reports the limitation.

Only one workflow may run per worktree. Different hosts in the same worktree
share its active workflow; they must not orchestrate it concurrently. Linked Git
worktrees have independent state. Uninstalling a plugin preserves all project
configuration and workflow state.
