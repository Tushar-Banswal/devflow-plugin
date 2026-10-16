#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const { HOSTS, hostInstructions } = require("../lib/hosts");
const { CHECKLISTS, rolePrompt } = require("../lib/personas");

const ROOT = path.resolve(__dirname, "..");
const META = require("../package.json");
const SCHEMA = "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json";

function write(root, name, value) {
  const file = path.join(root, name);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, typeof value === "string" ? value : JSON.stringify(value, null, 2) + "\n");
}

function copy(root, name) {
  fs.cpSync(path.join(ROOT, name), path.join(root, name), { recursive: true });
}

/** A persistent rule activates the protocol even when the host lacks session hooks. */
function activationRule(host) {
  const header = host === "antigravity"
    ? "---\ntrigger: always_on\ndescription: Activate DevFlow in every session and recover its review loop.\n---\n"
    : "---\napplyTo: \"**\"\ndescription: Activate DevFlow in every session and recover its review loop.\n---\n";
  return header + "\n# DevFlow automatic session activation\n\n" +
    "This rule is active whenever the DevFlow plugin is enabled. In each new main-agent session, " +
    "activate DevFlow automatically before handling the first user request. No slash command or " +
    "repository setup is required. Do not apply orchestration recursively inside a role subagent.\n\n" +
    "If the DevFlow protocol is not already in context, resolve the installed plugin root as the " +
    "parent of this rule's directory (for Copilot, two parents above its rules directory), then run " +
    "`node <installed-plugin-root>/bin/devflow.js context --host " + host + "` with JSON {} on stdin. " +
    "Quote the absolute script path for the local shell; this is a bundled resource, not a project-relative path. " +
    "Follow the returned protocol. If this is context recovery after compaction, pass " +
    "{\"source\":\"compact\"} instead; never repeat onboarding or reset an iteration.\n\n" +
    "Announce 'DevFlow active — REVIEWER → DEVELOPER workflow enabled.' once per new session, " +
    "including sessions that resume an existing workflow. If a session hook already supplied the " +
    "notice/protocol, do not announce twice. First read project workflow status; reuse active state. " +
    "Wait for a task when none is provided. Answer ordinary questions without initializing a " +
    "workflow. Development tasks automatically enter the reviewer-led loop.\n\n" + hostInstructions(host);
}

function skill(host, role) {
  const name = `devflow-${role}`;
  return `---\nname: ${name}\ndescription: ${role === "workflow" ? "Start or recover" : "Delegate to the " + role.toUpperCase() + " in"} the tracked DevFlow development and review loop.\n---\n\n` +
    "Resolve the installed plugin root as two directories above this SKILL.md's directory. " +
    "Render the shared lib/workflow.md protocol using " +
    "`node <installed-plugin-root>/bin/devflow.js context --host " + host + "` with JSON {} on stdin. " +
    "Quote the absolute script path and run with the target project's working directory. " +
    "Follow the returned protocol and host adapter. Restore active state before onboarding. " +
    "Use actual separate agents; never role-play either agent in the main conversation.\n\n" +
    (role === "developer" ? "Require a recorded REVIEWER brief before implementation. Continue through validation and the REVIEWER's recorded verdict.\n" :
      role === "reviewer" ? "For analysis-only requests, delegate analysis without initializing an implementation workflow. For implementation, plan before recording a brief.\n" : "Activation alone does not initialize a workflow. Use the supplied task and resolve only critical ambiguities.\n");
}

function runtime(root, host) {
  for (const name of ["lib", "bin", "LICENSE", "README.md", "docs"]) copy(root, name);
  for (const name of ["devflow-state.js", "devflow-activate.js"]) copy(root, `hooks/${name}`);
  write(root, "package.json", { name: "devflow", version: META.version, private: true, license: "MIT", engines: META.engines });
  if (host === "claude-code") {
    for (const name of ["agents", "skills", "settings.json", ".claude-plugin/plugin.json", "hooks/hooks.json"]) copy(root, name);
    return;
  }
  for (const role of ["reviewer", "developer"]) write(root, `resources/roles/${role}.md`, rolePrompt(role));
  for (const name of CHECKLISTS) {
    const original = fs.readFileSync(path.join(ROOT, "skills", name, "SKILL.md"), "utf8");
    write(root, `skills/devflow-${name}/SKILL.md`, original.replace(/^name: .+$/m, `name: devflow-${name}`).replaceAll("devflow:", "devflow-"));
  }
  for (const role of ["workflow", "reviewer", "developer"]) write(root, `skills/devflow-${role}/SKILL.md`, skill(host, role));
}

function copilotAgents(root) {
  for (const role of ["reviewer", "developer"]) {
    const tools = role === "reviewer" ? "tools: [\"read\", \"search\", \"web\"]\n" : "";
    write(root, `com.github.copilot/agents/devflow-${role}.agent.md`,
      `---\nname: devflow-${role}\ndescription: DevFlow ${role.toUpperCase()} workflow agent.\ninclude-custom-instructions: true\n${tools}---\n\n${rolePrompt(role)}`);
  }
}

function antigravityAgents(root) {
  for (const role of ["reviewer", "developer"]) {
    const tools = role === "reviewer"
      ? ["view_file", "list_dir", "find_by_name", "grep_search", "search_web", "read_url_content"]
      : ["view_file", "list_dir", "find_by_name", "grep_search", "search_web", "read_url_content", "write_to_file", "replace_file_content", "multi_replace_file_content", "run_command"];
    write(root, `agents/devflow-${role}.md`, `---\nname: devflow-${role}\ndescription: DevFlow ${role.toUpperCase()} workflow agent.\n` +
      `subagent: true\nmainAgent: false\nmodel: inherit\ncommandExecutionPolicy: ${role === "reviewer" ? "off" : "sandbox"}\n` +
      `tools: ${JSON.stringify(tools)}\n---\n\n${rolePrompt(role)}`);
  }
}

function packageHost(root, host) {
  fs.mkdirSync(root, { recursive: true });
  runtime(root, host);
  const manifest = { $schema: SCHEMA, name: "devflow", version: META.version, description: META.description, author: { name: META.author }, license: "MIT" };
  if (host === "codex") {
    manifest.extensions = { "com.openai": { hooks: "./hooks/hooks.json" } };
    write(root, "plugin.json", manifest);
    write(root, "hooks/hooks.json", { hooks: { SessionStart: [{ hooks: [{ type: "command", command: 'node "${PLUGIN_ROOT}/hooks/devflow-activate.js" --host codex', commandWindows: '& node "$env:PLUGIN_ROOT/hooks/devflow-activate.js" --host codex', timeout: 20, additionalContextLimit: 0 }] }] } });
  } else if (host === "copilot") {
    write(root, "plugin.json", manifest);
    copilotAgents(root);
    write(root, "com.github.copilot/hooks/hooks.json", { version: 1, hooks: { SessionStart: [{ type: "command", bash: 'node "${PLUGIN_ROOT}/hooks/devflow-activate.js" --host copilot', powershell: '& node "$env:PLUGIN_ROOT/hooks/devflow-activate.js" --host copilot', timeoutSec: 20 }] } });
    write(root, "com.github.copilot/rules/devflow.instructions.md", activationRule(host));
  } else if (host === "antigravity") {
    write(root, "plugin.json", { $schema: "https://antigravity.google/schemas/v1/plugin.json", name: "devflow", description: META.description });
    antigravityAgents(root);
    write(root, "rules/devflow.md", activationRule(host));
  }
  write(root, "VERIFICATION.json", { host, version: META.version, liveVerified: false, releaseReady: false, reason: "Requires recorded live automatic-activation and delegation smoke checks; see docs/verification.md in the source distribution." });
}

/** Build self-contained local plugin artifacts, refusing to replace unrelated output. */
function build(output = path.join(ROOT, "dist")) {
  const target = path.resolve(output);
  if (fs.existsSync(target)) {
    const stat = fs.lstatSync(target);
    const marker = path.join(target, "build.json");
    if (stat.isSymbolicLink() || !stat.isDirectory() || !fs.existsSync(marker) || JSON.parse(fs.readFileSync(marker, "utf8")).generator !== "devflow") {
      throw new Error(`Refusing to replace non-DevFlow output: ${target}`);
    }
  }
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const staging = fs.mkdtempSync(path.join(path.dirname(target), ".devflow-build-"));
  const backup = `${staging}.previous`;
  try {
    for (const host of HOSTS) packageHost(path.join(staging, host), host);
    const entry = (host) => ({ name: "devflow", source: `./${host}`, version: META.version, description: META.description });
    for (const [host, location] of [["claude-code", ".claude-plugin"], ["copilot", ".github/plugin"]]) {
      write(staging, `${location}/marketplace.json`, { name: `devflow-${host}`, owner: { name: META.author }, plugins: [entry(host)] });
    }
    write(staging, ".agents/plugins/marketplace.json", { name: "devflow-codex", interface: { displayName: "DevFlow" }, plugins: [{ name: "devflow", source: { source: "local", path: "./codex" }, policy: { installation: "AVAILABLE", authentication: "ON_INSTALL" }, category: "Productivity" }] });
    write(staging, "build.json", { generator: "devflow", version: META.version, hosts: HOSTS });
    if (fs.existsSync(target)) fs.renameSync(target, backup);
    try { fs.renameSync(staging, target); }
    catch (error) {
      if (fs.existsSync(backup)) fs.renameSync(backup, target);
      throw error;
    }
    fs.rmSync(backup, { recursive: true, force: true });
    return target;
  } finally {
    fs.rmSync(staging, { recursive: true, force: true });
  }
}

if (require.main === module) {
  try {
    const args = process.argv.slice(2);
    if (args.length && (args.length !== 2 || args[0] !== "--output")) throw new Error("Usage: build.js [--output DIRECTORY]");
    process.stdout.write(`Built DevFlow plugins: ${build(args[1])}\n`);
  } catch (error) { process.stderr.write(`DevFlow build error: ${error.message}\n`); process.exitCode = 1; }
}

module.exports = { build, activationRule };
