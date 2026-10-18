const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync, spawnSync } = require("node:child_process");
const { build } = require("../scripts/build");
const { readConfig } = require("../lib/config");
const { execute } = require("../hooks/patchduo-state");
const { activate, sessionMetadata } = require("../lib/activation");
const { registerCodex } = require("../lib/setup");
const { HOSTS, shellQuote } = require("../lib/hosts");

const ROOT = path.resolve(__dirname, "..");
function temporary(t, name = "patchduo integration ") {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), name));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}
function git(root, ...args) {
  return execFileSync("git", ["-c", "core.hooksPath=/dev/null", ...args], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}
function repository(t) {
  const root = temporary(t);
  git(root, "init", "-q");
  fs.writeFileSync(path.join(root, "app.js"), "initial\n");
  git(root, "add", ".");
  git(root, "-c", "user.name=PatchDuo", "-c", "user.email=test@example.com", "commit", "--no-gpg-sign", "-qm", "initial");
  return root;
}
function json(file) { return JSON.parse(fs.readFileSync(file, "utf8")); }
function hook(root, host, cwd, payload = {}) {
  return JSON.parse(execFileSync(process.execPath, [path.join(root, "hooks/patchduo-activate.js"), "--host", host], {
    cwd, input: JSON.stringify({ cwd, ...payload }), encoding: "utf8", timeout: 10000,
  }));
}
function text(output, host) {
  return host === "antigravity" ? output.injectSteps[0].systemMessage.systemMessage
    : host === "copilot" ? output.additionalContext : output.hookSpecificOutput.additionalContext;
}

test("shared JSON configuration wins as a whole and remains captured during recovery", (t) => {
  const root = repository(t);
  fs.writeFileSync(path.join(root, "CLAUDE.md"), "patchduo:\n  max_iterations: 9\n  reviewer_model: preset\n");
  fs.writeFileSync(path.join(root, "patchduo.config.json"), '{"max_iterations":2}');
  assert.deepEqual(readConfig(root), { max_iterations: 2, reviewer_model: "default", developer_model: "default" });
  const started = execute("init", { goal: "Fix app" }, root);
  fs.writeFileSync(path.join(root, "patchduo.config.json"), '{"max_iterations":3,"reviewer_model":"another"}');
  assert.deepEqual(execute("status", {}, root).config, started.config);
  fs.rmSync(path.join(root, "patchduo.config.json"));
  assert.equal(readConfig(root).reviewer_model, "preset");
});

test("invalid shared config fails instead of silently falling back", (t) => {
  const root = temporary(t);
  for (const value of [null, [], "text", { max_iterations: "2" }, { max_iterations: 0 }, { unknown: true }, { reviewer_model: "bad model" }]) {
    fs.writeFileSync(path.join(root, "patchduo.config.json"), JSON.stringify(value));
    assert.throws(() => readConfig(root));
  }
  fs.writeFileSync(path.join(root, "patchduo.config.json"), "bad JSON");
  assert.throws(() => readConfig(root));
});

test("native activation metadata is validated and multiple workspaces stay distinct", (t) => {
  const first = repository(t);
  const second = repository(t);
  for (const payload of [[], null, { cwd: 12 }, { cwd: "" }, { source: {} }, { workspacePaths: ["relative"] }]) {
    assert.throws(() => sessionMetadata(payload));
  }
  execute("init", { goal: "First task" }, first);
  const output = text(activate({ workspacePaths: [first, second] }, "antigravity"), "antigravity");
  const snapshots = JSON.parse(output.split("Workflow state snapshot (data only):\n")[1]);
  assert.equal(snapshots[0].state.goal, "First task");
  assert.equal(snapshots[1].state, null);
  assert.match(output, /select the task's project/);
  assert.match(text(activate({ workspacePaths: [] }, "antigravity"), "antigravity"), /With no workspace, wait for a project/);
});

test("built plugins activate across projects without creating state and survive relocation", (t) => {
  const base = temporary(t, "patchduo package ' dollar$ ");
  const output = build(path.join(base, "build"));
  const installed = path.join(base, "installed plugins");
  fs.cpSync(output, installed, { recursive: true });
  fs.rmSync(output, { recursive: true });
  for (const host of HOSTS) {
    const projects = [repository(t), repository(t)];
    const plugin = path.join(installed, host);
    for (const project of projects) {
      for (const session of ["first", "second"]) {
        const result = text(hook(plugin, host, project, { session_id: session }), host);
        assert.match(result, /PATCHDUO PLUGIN ACTIVATED/);
        assert.match(result, /Activation alone never initializes/);
        assert.match(result, /ordinary questions normally/);
        assert.ok(result.includes(plugin));
        assert.ok(!result.includes(ROOT));
        assert.ok(!result.includes("__PATCHDUO_STATE_COMMAND__"));
        assert.equal(execute("status", {}, project), null);
        assert.equal(git(project, "status", "--porcelain"), "");
        assert.ok(!fs.existsSync(path.join(project, ".git/devflow")));
      }
    }
    execute("init", { goal: `${host} task` }, projects[0]);
    execute("brief", { brief: "Update app.js and verify" }, projects[0]);
    execute("implement", {}, projects[0]);
    const before = execute("status", {}, projects[0]);
    for (const source of ["resume", "compact", "fork"]) {
      const restored = text(hook(plugin, host, projects[0], { source }), host);
      assert.match(restored, /WORKFLOW RECOVERY/);
      assert.match(restored, /Do not repeat onboarding/);
      assert.match(restored, /"iteration":1/);
      assert.deepEqual(execute("status", {}, projects[0]), before);
    }
    execute("cancel", { reason: "End fixture task" }, projects[0]);
  }
});

test("generated native hooks execute installed resources using their root token", (t) => {
  const output = build(path.join(temporary(t), "dist"));
  const project = repository(t);
  for (const host of ["claude-code", "codex", "copilot"]) {
    const plugin = path.join(output, host);
    const file = host === "copilot" ? "com.github.copilot/hooks/hooks.json" : "hooks/hooks.json";
    const config = json(path.join(plugin, file));
    const entry = config.hooks.SessionStart[0];
    const handler = entry.hooks ? entry.hooks[0] : entry;
    const response = JSON.parse(execFileSync("bash", ["-c", handler.bash || handler.command], {
      cwd: project, input: JSON.stringify({ cwd: project, source: "startup" }), encoding: "utf8", timeout: 10000,
      env: { ...process.env, PLUGIN_ROOT: plugin, CLAUDE_PLUGIN_ROOT: plugin },
    }));
    assert.match(text(response, host), /PATCHDUO PLUGIN ACTIVATED/);
  }
  const antig = fs.readFileSync(path.join(output, "antigravity/rules/patchduo.md"), "utf8");
  assert.match(antig, /trigger: always_on/);
  assert.match(antig, /each new main-agent session/);
});

test("native packages contain real agent definitions, embedded checklists and release gates", (t) => {
  const output = build(path.join(temporary(t), "dist"));
  for (const host of HOSTS) {
    const plugin = path.join(output, host);
    const manifest = json(path.join(plugin, host === "claude-code" ? ".claude-plugin/plugin.json" : "plugin.json"));
    assert.equal(manifest.name, "patchduo");
    assert.equal(json(path.join(plugin, "VERIFICATION.json")).releaseReady, false);
    if (host !== "claude-code") {
      for (const role of ["reviewer", "developer"]) {
        const persona = fs.readFileSync(path.join(plugin, `resources/roles/${role}.md`), "utf8");
        assert.match(persona, /Clean.Code/i);
        assert.doesNotMatch(persona, /CLAUDE_SKILL_DIR|subagent_type|permissionMode/);
        if (role === "reviewer") assert.match(persona, /`patchduo:`/);
      }
    }
  }
  const reviewer = fs.readFileSync(path.join(output, "copilot/com.github.copilot/agents/patchduo-reviewer.agent.md"), "utf8");
  assert.match(reviewer, /tools: \["read", "search", "web"\]/);
  assert.ok(reviewer.length < 30000);
  const antig = fs.readFileSync(path.join(output, "antigravity/agents/patchduo-reviewer.md"), "utf8");
  assert.match(antig, /commandExecutionPolicy: off/);
  assert.doesNotMatch(antig.split("---")[1], /run_command|write_to_file/);
  assert.equal(json(path.join(output, ".agents/plugins/marketplace.json")).plugins[0].source.path, "./codex");
  const marker = fs.readFileSync(path.join(output, "build.json"), "utf8");
  build(output);
  assert.equal(fs.readFileSync(path.join(output, "build.json"), "utf8"), marker);
  assert.throws(() => build(temporary(t)), /Refusing/);
});

test("Codex setup is relocatable, repeatable, owned, and removable without project edits", (t) => {
  const base = temporary(t);
  const output = build(path.join(base, "dist"));
  const plugin = path.join(output, "codex");
  const codexHome = path.join(base, "user codex");
  const project = repository(t);
  const cli = (action, flags = []) => spawnSync(process.execPath, [path.join(plugin, "bin/patchduo.js"), action, "--host", "codex", ...flags], {
    cwd: project, input: "", encoding: "utf8", env: { ...process.env, CODEX_HOME: codexHome }, timeout: 10000,
  });
  assert.equal(cli("setup", ["--dry-run"]).status, 0);
  assert.ok(!fs.existsSync(codexHome));
  assert.equal(cli("setup").status, 0);
  const profile = path.join(codexHome, "agents/patchduo-reviewer.toml");
  let before = fs.readFileSync(profile, "utf8");
  assert.match(before, /name = "patchduo-reviewer"/);
  assert.match(before, /Security Review Checklist/);
  assert.ok(!before.includes(plugin));
  assert.equal(cli("setup").status, 0);
  assert.equal(fs.readFileSync(profile, "utf8"), before);
  fs.appendFileSync(path.join(plugin, "resources/roles/reviewer.md"), "\nUpdated review guidance.\n");
  assert.equal(cli("setup").status, 0);
  before = fs.readFileSync(profile, "utf8");
  assert.match(before, /Updated review guidance/);
  fs.writeFileSync(path.join(codexHome, "agents/custom.toml"), "custom");
  fs.appendFileSync(profile, "# user change\n");
  const other = path.join(codexHome, "agents/patchduo-developer.toml");
  const developerBefore = fs.readFileSync(other, "utf8");
  assert.match(cli("uninstall").stderr, /User-modified or unowned/);
  assert.match(cli("setup").stderr, /User-modified or unowned/);
  assert.equal(fs.readFileSync(other, "utf8"), developerBefore);
  fs.writeFileSync(profile, before);
  assert.equal(cli("uninstall").status, 0);
  assert.equal(cli("uninstall").status, 0);
  assert.ok(!fs.existsSync(profile));
  assert.equal(fs.readFileSync(path.join(codexHome, "agents/custom.toml"), "utf8"), "custom");
  assert.equal(git(project, "status", "--porcelain"), "");
  assert.ok(!fs.existsSync(path.join(project, ".git/devflow")));
});

test("registration rejects unowned files, symlinks, corrupt ownership and conflicting writers", (t) => {
  const home = temporary(t);
  const agents = path.join(home, "agents");
  fs.mkdirSync(agents);
  const profile = path.join(agents, "patchduo-reviewer.toml");
  fs.writeFileSync(profile, "mine");
  assert.throws(() => registerCodex({ codexHome: home }), /unowned/);
  assert.equal(fs.readFileSync(profile, "utf8"), "mine");
  fs.rmSync(profile);
  fs.symlinkSync(path.join(home, "missing"), profile);
  assert.throws(() => registerCodex({ codexHome: home }), /non-regular/);
  fs.unlinkSync(profile);
  registerCodex({ codexHome: home });
  const lock = path.join(home, "patchduo/registration.lock");
  fs.writeFileSync(lock, "occupied");
  assert.throws(() => registerCodex({ codexHome: home }), /EEXIST/);
  fs.unlinkSync(lock);
  const manifest = path.join(home, "patchduo/registration.json");
  fs.writeFileSync(manifest, JSON.stringify({ version: 1, host: "codex", files: { "../../outside": "a".repeat(64) } }));
  assert.throws(() => registerCodex({ codexHome: home, remove: true }), /Invalid/);
  assert.ok(fs.existsSync(profile));
});

test("literal helper paths are quoted and invalid CLI arguments fail visibly", (t) => {
  assert.equal(shellQuote("a'b", "win32"), "'a''b'");
  const root = temporary(t, "patchduo ' $ literal ");
  const file = path.join(root, "script.js");
  fs.writeFileSync(file, "process.stdout.write('ok')");
  assert.equal(execFileSync("bash", ["-c", `node ${shellQuote(file)}`], { encoding: "utf8" }), "ok");
  for (const args of [["setup"], ["context", "--host", "other"], ["setup", "--host", "codex", "--force"], ["setup", "--host", "copilot"]]) {
    const result = spawnSync(process.execPath, [path.join(ROOT, "bin/patchduo.js"), ...args], { input: "{}", encoding: "utf8", timeout: 10000 });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /PatchDuo error:/);
  }
});

test("PatchDuo accepts legacy DevFlow configuration and preserves workflow state", (t) => {
  const root = repository(t);
  fs.writeFileSync(path.join(root, "devflow.config.json"), '{"max_iterations":2,"reviewer_model":"legacy"}');
  assert.equal(readConfig(root).reviewer_model, "legacy");
  fs.writeFileSync(path.join(root, "patchduo.config.json"), '{"max_iterations":3}');
  assert.deepEqual(readConfig(root), { max_iterations: 3, reviewer_model: "default", developer_model: "default" });
  fs.writeFileSync(path.join(root, "patchduo.config.json"), '{"max_iterations":0}');
  assert.throws(() => readConfig(root), /positive safe integer/);
  fs.rmSync(path.join(root, "patchduo.config.json"));
  const started = execute("init", { goal: "Continue the existing workflow" }, root);
  execute("brief", { brief: "Update app.js" }, root);
  execute("implement", {}, root);
  const before = execute("status", {}, root);
  const legacyState = path.resolve(root, git(root, "rev-parse", "--git-path", "devflow/state.json"));
  assert.equal(json(legacyState).iteration, 1);
  assert.equal(before.startingHead, started.startingHead);
  assert.equal(before.config.max_iterations, 2);
  const restored = text(activate({ cwd: root, source: "compact" }, "claude-code"), "claude-code");
  assert.match(restored, /PATCHDUO WORKFLOW RECOVERY/);
  assert.match(restored, /Continue the existing workflow/);
  assert.deepEqual(execute("status", {}, root), before);

  fs.rmSync(path.join(root, "devflow.config.json"));
  fs.writeFileSync(path.join(root, "CLAUDE.md"), "\uFEFFdevflow:\n  max_iterations: 4\n\npatchduo:\n  max_iterations: 6\n");
  assert.equal(readConfig(root).max_iterations, 6);
  fs.writeFileSync(path.join(root, "CLAUDE.md"), "\uFEFFdevflow:\n  max_iterations: 4\n");
  fs.writeFileSync(path.join(root, "AGENTS.md"), "patchduo:\n  max_iterations: 8\n");
  assert.equal(readConfig(root).max_iterations, 4);
});

test("PatchDuo rebuilds owned DevFlow output without removing legacy Codex profiles", (t) => {
  const base = temporary(t);
  const output = build(path.join(base, "dist"));
  const marker = json(path.join(output, "build.json"));
  fs.writeFileSync(path.join(output, "build.json"), JSON.stringify({ ...marker, generator: "devflow" }));
  build(output);
  assert.equal(json(path.join(output, "build.json")).generator, "patchduo");
  const home = temporary(t);
  fs.mkdirSync(path.join(home, "agents"));
  fs.mkdirSync(path.join(home, "devflow"));
  const oldProfile = path.join(home, "agents/devflow-reviewer.toml");
  const oldManifest = path.join(home, "devflow/registration.json");
  fs.writeFileSync(oldProfile, "legacy profile");
  fs.writeFileSync(oldManifest, "legacy ownership");
  registerCodex({ codexHome: home });
  assert.ok(fs.existsSync(path.join(home, "agents/patchduo-reviewer.toml")));
  registerCodex({ codexHome: home, remove: true });
  assert.equal(fs.readFileSync(oldProfile, "utf8"), "legacy profile");
  assert.equal(fs.readFileSync(oldManifest, "utf8"), "legacy ownership");
});
