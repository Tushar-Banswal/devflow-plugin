# Host verification and release gate

The new adapters are integration candidates. Automated tests invoke the packaged
runtime and native hook commands; they do not prove that an actual model discovers
a plugin, obeys its rules, or invokes the intended agents. `VERIFICATION.json` in
each build deliberately records `liveVerified: false` and `releaseReady: false`.
Do not advertise a host surface as supported until the live checks below pass.
Antigravity IDE and hosted/cloud agents are outside this release.

## Automated checks

Run `npm test` and `npm run build` from the source root. The tests cover:

- The existing state machine, rejection/fix loops, iteration exhaustion, malformed
  verdicts, stale approvals, worktree isolation, locks, and interrupted workflows.
- Shared JSON configuration precedence, validation, and captured configuration.
- Relocated plugin packages, all response envelopes, native hook shell commands,
  two unrelated repositories, multiple workspaces, and activation without writes.
- Codex setup, repeated setup/update, cleanup, ownership conflicts, symlinks,
  malformed registration data, and preservation of unrelated profiles.

Where installed, run `agy plugin validate dist/antigravity`. This validates the
package and agents, not automatic activation or live delegation.

## Checks recorded for this implementation

The following checks were recorded under the previous DevFlow name, before the
PatchDuo rename. Repeat native installation and live checks for the renamed packages.

On October 16, 2026, Linux with Node 24.21.0:

- The automated suite passed all 22 behavioral tests.
- Codex CLI 0.162.0-alpha.2 registered the generated local marketplace and installed
  `devflow@devflow-codex` version 1.2.0 in an isolated temporary user configuration;
  plugin removal and marketplace cleanup also succeeded.
- Both generated Codex profiles parsed successfully with Python's TOML parser.
- Antigravity CLI 1.3.1 accepted `agy plugin validate dist/antigravity`, processing
  eight skills and two agents. Its validator did not report rule execution.
- Claude Code and Copilot executables were not available in this environment.

These are automated, native installation, and static validation results. No new
adapter has completed a model-driven live activation/delegation check. GUI
session behavior and Windows shell paths also remain unverified.

## Live acceptance procedure

Record the host, exact CLI/app/extension versions, OS, Node version, hook trust or
workspace trust settings, plugin version, commands used, and resulting agent/tool
traces. Test Codex CLI and app separately, Copilot CLI and VS Code separately, and
Antigravity App and CLI separately. A passing CLI check does not certify its GUI.

1. Install once at user scope using the installation guide. Complete the host's
   normal hook trust review and Codex profile setup if applicable. Use two clean,
   unrelated Git repositories with initial commits and no PatchDuo config files.
2. Open a new session in repository A. Ask an ordinary question. Confirm a single
   activation notice, no onboarding questions for an empty goal, no implementation
   workflow, no repository edits, and no newly created Git PatchDuo state directory.
3. Open another new session in A, then a new session in B. Confirm automatic
   activation each time without a command, repository instructions, or reinstall.
4. Supply a small development task. Verify actual separate REVIEWER and DEVELOPER
   contexts in native traces. The reviewer must plan first, the developer must
   receive its brief, and the reviewer must return a recorded JSON verdict.
5. Exercise a rejection followed by a fix and approval. Set max_iterations to 1
   for another task and verify rejection escalates without starting another pass.
6. Interrupt implementation, resume, and compact. Verify the same goal, brief,
   issues, captured configuration, and iteration survive. No repeated onboarding
   or compaction notice; startup in a new session still gets one activation notice.
7. Request an unavailable model or disable delegation. Verify PatchDuo reports the
   limitation before implementation, with no replacement model or role-playing.
8. Change a file after approval. Verify approval is stale. Run two linked worktrees
   and confirm their workflow state remains independent.
9. Disable PatchDuo using the host's controls. Open a fresh session: no automatic
   PatchDuo activation. Enable it and open another: activation returns and active
   workflow state is recovered.
10. Update the plugin, refresh Codex registrations if applicable, and repeat the
    startup check. Uninstall, clean up owned Codex profiles, and confirm existing
    project state, configuration, unrelated plugins, and user instructions remain.

Publish the evidence and a versioned compatibility record before changing the
release gate. No fixture output or generated metadata counts as a live result.

## Primary format references

- Claude: https://code.claude.com/docs/en/plugins-reference
- Codex packaging: https://developers.openai.com/plugins/build/plugins
- Codex hooks: https://learn.chatgpt.com/docs/hooks
- Codex agents: https://learn.chatgpt.com/docs/agent-configuration/subagents
- Copilot packages: https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-plugin-reference
- Copilot hooks: https://docs.github.com/en/copilot/reference/hooks-reference
- Copilot VS Code: https://code.visualstudio.com/docs/agent-customization/agent-plugins
- Antigravity packages: https://www.antigravity.google/docs/plugins
- Antigravity rules: https://www.antigravity.google/docs/rules/
- Antigravity agents: https://www.antigravity.google/docs/subagents/

Formats were checked against official documentation on October 16, 2026.
