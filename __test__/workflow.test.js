const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync, spawnSync } = require("node:child_process");
const { execute, fingerprint } = require("../hooks/devflow-state");
const { readConfig, resolveConfig } = require("../lib/config");

const ROOT = path.resolve(__dirname, "..");
function git(root, ...args) {
  return execFileSync("git", ["-c", "core.hooksPath=/dev/null", ...args], { cwd: root, stdio: ["ignore", "pipe", "pipe"] }).toString().trim();
}
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "devflow test "));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  git(root, "init", "-q");
  fs.writeFileSync(path.join(root, "app.js"), "initial\n");
  git(root, "add", ".");
  git(root, "-c", "user.name=DevFlow Test", "-c", "user.email=test@example.com", "commit", "--no-gpg-sign", "-qm", "initial");
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
  fs.writeFileSync(path.join(root, "AGENTS.md"), "devflow:\n  reviewer_model: opus\n");
  assert.equal(readConfig(root).reviewer_model, "opus");
  fs.writeFileSync(path.join(root, "CLAUDE.md"), "devflow:\n  max_iterations: 2 # bounded\n  reviewer_model: 'sonnet'\n  developer_model: default\n");
  assert.deepEqual(resolveConfig(readConfig(root), { reviewer_model: "haiku", developer_model: "opus" }), {
    max_iterations: 2, reviewer_model: "sonnet", developer_model: "opus",
  });
});

test("invalid config values and duplicate keys fail before initialization", (t) => {
  const root = fixture(t);
  for (const block of ["  max_iterations: 0", "  max_iterations: 1.5", "  reviewer_model: 'bad model'", "  unknown: true", "  max_iterations: 2\n  max_iterations: 3"]) {
    fs.writeFileSync(path.join(root, "CLAUDE.md"), `devflow:\n${block}\n`);
    assert.throws(() => run(root, "init", { goal: "test" }));
    assert.equal(run(root, "status"), null);
  }
});

test("state persists across processes; invalid transitions preserve state", (t) => {
  const root = fixture(t);
  assert.throws(() => run(root, "implement"), /Expected phase/);
  ready(root);
  const result = execFileSync(process.execPath, [path.join(ROOT, "hooks/devflow-state.js"), "status"], { cwd: root, input: "{}" });
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
  fs.writeFileSync(path.join(root, "CLAUDE.md"), "devflow:\n  max_iterations: 1\n");
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
    const output = execFileSync(process.execPath, [path.join(ROOT, "hooks/devflow-activate.js")], { cwd: root, input: JSON.stringify({ source, cwd: root }) });
    const result = JSON.parse(output).hookSpecificOutput;
    assert.equal(result.hookEventName, "SessionStart");
    assert.match(result.additionalContext, /devflow:reviewer/);
    assert.match(result.additionalContext, /Update app.js/);
    if (["resume", "compact"].includes(source)) assert.match(result.additionalContext, /RECOVERY[\s\S]*Do not repeat onboarding/);
  }
  assert.deepEqual(run(root, "status"), before);
  run(root, "implement");
  const resumed = JSON.parse(execFileSync(process.execPath, [path.join(ROOT, "hooks/devflow-activate.js")], { cwd: root, input: JSON.stringify({ source: "resume" }) })).hookSpecificOutput.additionalContext;
  assert.match(resumed, /"phase":"implementing"/);
  assert.equal(run(root, "status").iteration, 1);
});

test("malformed metadata and state input fail visibly; non-Git hook stays usable", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "devflow nongit "));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const [script, args] of [["devflow-activate.js", []], ["devflow-state.js", ["init"]]]) {
    const result = spawnSync(process.execPath, [path.join(ROOT, "hooks", script), ...args], { cwd: root, input: "bad JSON", encoding: "utf8" });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /DevFlow .* error/);
  }
  const output = execFileSync(process.execPath, [path.join(ROOT, "hooks/devflow-activate.js")], { cwd: root, input: "{}" });
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
    assert.match(skill, new RegExp(`subagent_type: devflow:${role}`));
    assert.match(skill, /lib\/workflow.md/);
  }
  assert.ok(fs.existsSync(path.join(ROOT, "LICENSE")));
});


test("an initial commit is required before recording a workflow", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "devflow unborn "));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  git(root, "init", "-q");
  assert.throws(() => run(root, "init", { goal: "test" }));
  assert.equal(run(root, "status"), null);
});
