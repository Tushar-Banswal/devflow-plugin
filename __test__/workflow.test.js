const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync, spawnSync } = require("node:child_process");
const { execute, fingerprint } = require("../hooks/patchduo-state");
const { readConfig, resolveConfig } = require("../lib/config");

const ROOT = path.resolve(__dirname, "..");
function git(root, ...args) {
  return execFileSync("git", ["-c", "core.hooksPath=/dev/null", ...args], { cwd: root, stdio: ["ignore", "pipe", "pipe"] }).toString().trim();
}
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "patchduo test "));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  git(root, "init", "-q");
  fs.writeFileSync(path.join(root, "app.js"), "initial\n");
  git(root, "add", ".");
  git(root, "-c", "user.name=PatchDuo Test", "-c", "user.email=test@example.com", "commit", "--no-gpg-sign", "-qm", "initial");
  return root;
}
function run(root, command, input = {}) { return execute(command, input, root); }
function ready(root) {
  run(root, "init", { goal: "Fix app" });
  return run(root, "brief", { brief: "Update app.js; validate behavior" });
}
function review(root) {
  run(root, "implement");
  fs.appendFileSync(path.join(root, "app.js"), "updated\n");
  return run(root, "review");
}
const approved = { result: "APPROVED", summary: "Verified changes and tests", issues: [] };
const rejected = { result: "REJECTED", summary: "Incorrect result", issues: ["app.js:1 — fix the result"] };

test("config defaults, file precedence, partial presets and preferences", (t) => {
  const root = fixture(t);
  assert.equal(readConfig(root).max_iterations, 5);
  fs.writeFileSync(path.join(root, "AGENTS.md"), "patchduo:\n  reviewer_model: opus\n");
  assert.equal(readConfig(root).reviewer_model, "opus");
  fs.writeFileSync(path.join(root, "CLAUDE.md"), "patchduo:\n  max_iterations: 2 # bounded\n  reviewer_model: 'sonnet'\n  developer_model: default\n");
  assert.deepEqual(resolveConfig(readConfig(root), { reviewer_model: "haiku", developer_model: "opus" }), {
    max_iterations: 2, reviewer_model: "sonnet", developer_model: "opus",
  });
});

test("invalid config values and duplicate keys fail before initialization", (t) => {
  const root = fixture(t);
  for (const block of ["  max_iterations: 0", "  max_iterations: 1.5", "  reviewer_model: 'bad model'", "  unknown: true", "  max_iterations: 2\n  max_iterations: 3"]) {
    fs.writeFileSync(path.join(root, "CLAUDE.md"), `patchduo:\n${block}\n`);
    assert.throws(() => run(root, "init", { goal: "test" }));
    assert.equal(run(root, "status"), null);
  }
});

test("state persists across processes; invalid transitions preserve state", (t) => {
  const root = fixture(t);
  assert.throws(() => run(root, "implement"), /Expected phase/);
  ready(root);
  const result = execFileSync(process.execPath, [path.join(ROOT, "hooks/patchduo-state.js"), "status"], { cwd: root, input: "{}" });
  assert.equal(JSON.parse(result).brief, "Update app.js; validate behavior");
  assert.throws(() => run(root, "init", { goal: "reset" }), /already active/);
  assert.throws(() => run(root, "verdict", approved), /Expected phase/);
  assert.equal(run(root, "status").phase, "ready");
});

test("rejection, fix and approval preserve issue context and count passes", (t) => {
  const root = fixture(t);
  ready(root);
  review(root);
  assert.equal(run(root, "verdict", rejected).phase, "rejected");
  assert.equal(run(root, "implement").iteration, 2);
  assert.deepEqual(run(root, "status").verdict.issues, rejected.issues);
  run(root, "review");
  assert.equal(run(root, "verdict", approved).phase, "approved");
  assert.equal(run(root, "status").phase, "approved");
});

test("iteration exhaustion escalates and cannot start another implementation", (t) => {
  const root = fixture(t);
  fs.writeFileSync(path.join(root, "CLAUDE.md"), "patchduo:\n  max_iterations: 1\n");
  ready(root);
  review(root);
  assert.equal(run(root, "verdict", rejected).phase, "escalated");
  assert.throws(() => run(root, "implement"), /Expected phase/);
  assert.equal(run(root, "status").iteration, 1);
});

test("verdict structure and snapshot changes are checked", (t) => {
  const root = fixture(t);
  ready(root);
  review(root);
  for (const verdict of [{}, { ...approved, issues: ["blocker"] }, { ...rejected, issues: [] }, { ...approved, summary: "" }, { ...rejected, issues: ["missing file reference"] }]) {
    assert.throws(() => run(root, "verdict", verdict));
  }
  fs.writeFileSync(path.join(root, "new file.js"), "unreviewed");
  assert.throws(() => run(root, "verdict", approved), /Files changed/);
  run(root, "refresh-review");
  run(root, "verdict", approved);
  fs.writeFileSync(path.join(root, "new file.js"), "changed again");
  assert.equal(run(root, "status").phase, "stale");
});

test("fingerprint includes staged and untracked changes, excludes ignored files", (t) => {
  const root = fixture(t);
  const initial = fingerprint(root);
  fs.appendFileSync(path.join(root, "app.js"), "staged\n");
  git(root, "add", "app.js");
  assert.notEqual(fingerprint(root), initial);
  fs.writeFileSync(path.join(root, ".gitignore"), "ignored.txt\n");
  const snapshot = fingerprint(root);
  fs.writeFileSync(path.join(root, "ignored.txt"), "excluded");
  assert.equal(fingerprint(root), snapshot);
});

test("cancellation is explicit and lock conflicts cannot corrupt state", (t) => {
  const root = fixture(t);
  ready(root);
  const file = path.resolve(root, git(root, "rev-parse", "--git-path", "devflow/state.json"));
  fs.writeFileSync(`${file}.lock`, "");
  assert.throws(() => run(root, "implement"), /EEXIST/);
  assert.equal(run(root, "status").phase, "ready");
  fs.unlinkSync(`${file}.lock`);
  assert.throws(() => run(root, "cancel"), /reason/);
  assert.equal(run(root, "cancel", { reason: "User replaced the goal" }).phase, "cancelled");
  assert.equal(run(root, "init", { goal: "new goal" }).iteration, 0);
});

test("linked worktrees have separate state", (t) => {
  const root = fixture(t);
  ready(root);
  const linked = path.join(path.dirname(root), `${path.basename(root)} linked`);
  t.after(() => fs.rmSync(linked, { recursive: true, force: true }));
  git(root, "worktree", "add", "--detach", linked);
  assert.equal(run(linked, "status"), null);
  run(linked, "init", { goal: "separate goal" });
  assert.equal(run(root, "status").goal, "Fix app");
});

test("hook recovers session state without changing it", (t) => {
  const root = fixture(t);
  ready(root);
  const before = run(root, "status");
  for (const source of ["startup", "resume", "clear", "compact"]) {
    const output = execFileSync(process.execPath, [path.join(ROOT, "hooks/patchduo-activate.js")], { cwd: root, input: JSON.stringify({ source, cwd: root }) });
    const result = JSON.parse(output).hookSpecificOutput;
    assert.equal(result.hookEventName, "SessionStart");
    assert.match(result.additionalContext, /patchduo:reviewer/);
    assert.match(result.additionalContext, /Update app.js/);
    if (["resume", "compact"].includes(source)) assert.match(result.additionalContext, /RECOVERY[\s\S]*Do not repeat onboarding/);
  }
  assert.deepEqual(run(root, "status"), before);
  run(root, "implement");
  const resumed = JSON.parse(execFileSync(process.execPath, [path.join(ROOT, "hooks/patchduo-activate.js")], { cwd: root, input: JSON.stringify({ source: "resume" }) })).hookSpecificOutput.additionalContext;
  assert.match(resumed, /"phase":"implementing"/);
  assert.equal(run(root, "status").iteration, 1);
});

test("malformed metadata and state input fail visibly; non-Git hook stays usable", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "patchduo nongit "));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const [script, args] of [["patchduo-activate.js", []], ["patchduo-state.js", ["init"]]]) {
    const result = spawnSync(process.execPath, [path.join(ROOT, "hooks", script), ...args], { cwd: root, input: "bad JSON", encoding: "utf8" });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /PatchDuo .* error/);
  }
  const output = execFileSync(process.execPath, [path.join(ROOT, "hooks/patchduo-activate.js")], { cwd: root, input: "{}" });
  assert.match(JSON.parse(output).hookSpecificOutput.additionalContext, /"unavailable":true/);
});

test("plugin packaging preserves read-only tools and explicit delegation", () => {
  for (const file of [".claude-plugin/plugin.json", ".claude-plugin/marketplace.json", "hooks/hooks.json", "settings.json", "package.json"]) {
    assert.doesNotThrow(() => JSON.parse(fs.readFileSync(path.join(ROOT, file), "utf8").replace(/^\uFEFF/, "")));
  }
  const reviewer = fs.readFileSync(path.join(ROOT, "agents/reviewer.md"), "utf8");
  assert.match(reviewer, /^tools: \[Read, Grep, Glob, WebSearch\]$/m);
  for (const role of ["reviewer", "developer"]) {
    const agent = fs.readFileSync(path.join(ROOT, `agents/${role}.md`), "utf8");
    assert.doesNotMatch(agent.split("---")[1], /permissionMode:/);
    const skill = fs.readFileSync(path.join(ROOT, `skills/${role}/SKILL.md`), "utf8");
    assert.match(skill, new RegExp(`subagent_type: patchduo:${role}`));
    assert.match(skill, /lib\/workflow.md/);
  }
  assert.ok(fs.existsSync(path.join(ROOT, "LICENSE")));
});


test("an initial commit is required before recording a workflow", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "patchduo unborn "));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  git(root, "init", "-q");
  assert.throws(() => run(root, "init", { goal: "test" }));
  assert.equal(run(root, "status"), null);
});


test("committed implementation evidence survives process and session recovery", (t) => {
  const root = fixture(t);
  const startingHead = git(root, "rev-parse", "HEAD");
  assert.equal(ready(root).startingHead, startingHead);
  run(root, "implement");
  fs.appendFileSync(path.join(root, "app.js"), "committed implementation\n");
  git(root, "add", "app.js");
  git(root, "-c", "user.name=PatchDuo Test", "-c", "user.email=test@example.com", "commit", "--no-gpg-sign", "-qm", "implement");
  const head = git(root, "rev-parse", "HEAD");
  assert.notEqual(head, startingHead);
  assert.equal(git(root, "diff", "--cached", "HEAD"), "");
  assert.equal(git(root, "diff"), "");

  const before = run(root, "status");
  const output = execFileSync(process.execPath, [path.join(ROOT, "hooks/patchduo-state.js"), "evidence"], { cwd: root, input: "{}" });
  const evidence = JSON.parse(output);
  assert.equal(evidence.startingHead, startingHead);
  assert.equal(evidence.head, head);
  assert.match(evidence.committedDiff, /\+committed implementation/);
  assert.equal(evidence.stagedDiff, "");
  assert.equal(evidence.unstagedDiff, "");
  assert.deepEqual(evidence.untrackedFiles, []);
  assert.deepEqual(run(root, "status"), before);
  for (const source of ["resume", "compact"]) {
    const context = JSON.parse(execFileSync(process.execPath, [path.join(ROOT, "hooks/patchduo-activate.js")], { cwd: root, input: JSON.stringify({ source, cwd: root }) })).hookSpecificOutput.additionalContext;
    assert.ok(context.includes(`"startingHead":"${startingHead}"`));
  }
  run(root, "review");
  run(root, "verdict", rejected);
  run(root, "implement");
  fs.appendFileSync(path.join(root, "app.js"), "committed fix\n");
  git(root, "add", "app.js");
  git(root, "-c", "user.name=PatchDuo Test", "-c", "user.email=test@example.com", "commit", "--no-gpg-sign", "-qm", "fix");
  const next = run(root, "evidence");
  assert.equal(next.startingHead, startingHead);
  assert.match(next.committedDiff, /\+committed implementation/);
  assert.match(next.committedDiff, /\+committed fix/);
  run(root, "review");
  run(root, "refresh-review");
  assert.equal(run(root, "status").startingHead, startingHead);
});

test("evidence separates committed, staged, unstaged and untracked changes", (t) => {
  const root = fixture(t);
  ready(root);
  run(root, "implement");
  fs.appendFileSync(path.join(root, "app.js"), "committed implementation\n");
  git(root, "add", "app.js");
  git(root, "-c", "user.name=PatchDuo Test", "-c", "user.email=test@example.com", "commit", "--no-gpg-sign", "-qm", "implement");
  fs.appendFileSync(path.join(root, "app.js"), "staged change\n");
  git(root, "add", "app.js");
  fs.appendFileSync(path.join(root, "app.js"), "unstaged change\n");
  fs.writeFileSync(path.join(root, "new file.js"), "untracked change\n");
  const evidence = run(root, "evidence");
  assert.match(evidence.committedDiff, /\+committed implementation/);
  assert.doesNotMatch(evidence.committedDiff, /staged change/);
  assert.match(evidence.stagedDiff, /\+staged change/);
  assert.doesNotMatch(evidence.stagedDiff, /\+unstaged change/);
  assert.match(evidence.unstagedDiff, /\+unstaged change/);
  assert.deepEqual(evidence.untrackedFiles, ["new file.js"]);
});

test("evidence refuses missing or unavailable baselines without changing state", (t) => {
  const root = fixture(t);
  assert.throws(() => run(root, "evidence"), /no starting commit/);
  ready(root);
  const file = path.resolve(root, git(root, "rev-parse", "--git-path", "devflow/state.json"));
  const original = run(root, "status");
  for (const startingHead of [undefined, "0".repeat(40)]) {
    const state = { ...original, startingHead };
    fs.writeFileSync(file, JSON.stringify(state));
    const before = fs.readFileSync(file, "utf8");
    assert.throws(() => run(root, "evidence"));
    assert.equal(fs.readFileSync(file, "utf8"), before);
  }
});


test("configuration errors identify the selected current or legacy rules block", (t) => {
  const root = fixture(t);
  for (const name of ["CLAUDE.md", "AGENTS.md"]) {
    const file = path.join(root, name);
    for (const brand of ["patchduo", "devflow"]) {
      for (const settings of [
        "  max_iterations 2",
        "  unknown: true",
        "  max_iterations: 2\n  max_iterations: 3",
      ]) {
        fs.writeFileSync(file, `${brand}:\n${settings}\n`);
        assert.throws(() => readConfig(root), (error) => {
          assert.ok(error.message.startsWith(`Invalid or duplicate ${brand} setting in ${name}:`));
          return true;
        });
      }
    }
    fs.writeFileSync(file, "devflow:\n  unknown: true\n\npatchduo:\n  max_iterations: 2\n  max_iterations: 3\n");
    assert.throws(() => readConfig(root), (error) => {
      assert.ok(error.message.startsWith(`Invalid or duplicate patchduo setting in ${name}:`));
      return true;
    });
    fs.rmSync(file);
  }
});
