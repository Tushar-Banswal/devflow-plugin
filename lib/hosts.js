const fs = require("node:fs");
const path = require("node:path");

const HOSTS = ["claude-code", "codex", "copilot", "antigravity"];

/** Reject unknown hosts rather than silently selecting a different adapter. */
function requireHost(host) {
  if (!HOSTS.includes(host)) throw new Error(`Unknown host ${host}; choose ${HOSTS.join(", ")}`);
  return host;
}

/** Quote a literal path for the local POSIX shell or Windows PowerShell. */
function shellQuote(value, platform = process.platform) {
  return platform === "win32" ? `'${value.replaceAll("'", "''")}'` : `'${value.replaceAll("'", "'\\''")}'`;
}

/** Keep native delegation details separate from the shared review protocol. */
function hostInstructions(host) {
  requireHost(host);
  const common = "Use the same project/worktree for both agents. Wait for each result before advancing. " +
    "Only the orchestrator runs state transitions. Read the bundled role instructions and checklists " +
    "and include them in delegation prompts when the host does not load them automatically.";
  const instructions = {
    "claude-code": "Use the Agent tool with subagent_type `devflow:reviewer` or `devflow:developer`. " +
      "Pass non-default models using its model parameter. The reviewer has only read/search/web tools.",
    codex: "Spawn real Codex subagents using the native subagent tool with agent types " +
      "`devflow-reviewer` and `devflow-developer`. These profiles require one-time registration: " +
      "`node bin/devflow.js setup --host codex` from the installed plugin directory. If missing, " +
      "report that command using the installed plugin's absolute path; do not substitute agents. " +
      "Profiles inherit the session model. Honor non-default models only through a supported " +
      "explicit spawn override; otherwise stop and explain. The reviewer is read-only by instruction: " +
      "Codex inherits parent permissions and does not create a separate read-only sandbox.",
    copilot: "Use Copilot's native subagent/agent tool to invoke the installed `devflow-reviewer` " +
      "and `devflow-developer` agents. Resolve their plugin namespace from the loaded inventory. " +
      "Agent selection or handoff in the main chat is not separate delegation. The reviewer has " +
      "only read/search/web tools. Profiles inherit the session model. Honor non-default models " +
      "only through a supported per-invocation model selector; otherwise stop and explain.",
    antigravity: "Use `invoke_subagent` with TypeName `devflow-reviewer` or `devflow-developer` " +
      "(resolve the installed namespace from the loaded agent inventory). Use the current workspace, " +
      "not a new branch/worktree. The reviewer has read/search/web tools and commandExecutionPolicy off. " +
      "Profiles inherit the parent model. Honor non-default models only through a supported native " +
      "selector; otherwise stop and explain. This adapter targets App/CLI; IDE is unverified.",
  };
  return `## Host adapter: ${host}\n\n${instructions[host]}\n\n${common}\n`;
}

/** Resolve the protocol against the installed package, independent of the checkout. */
function renderProtocol(host, root = path.resolve(__dirname, "..")) {
  const command = `${process.platform === "win32" ? "& " : ""}node ${shellQuote(path.join(root, "hooks/devflow-state.js"))}`;
  const workflow = fs.readFileSync(path.join(root, "lib/workflow.md"), "utf8")
    .replaceAll("__DEVFLOW_STATE_COMMAND__", command);
  const roles = host === "claude-code" ? "agents" : "resources/roles";
  return `${workflow}\n${hostInstructions(host)}\nInstalled DevFlow resources: ${root}\n` +
    `Role instructions: ${roles}/reviewer.md and ${roles}/developer.md under this package. ` +
    "Checklists: skills/*/SKILL.md under this package. Run state commands with the target " +
    "project's working directory, never the plugin directory.\n";
}

module.exports = { HOSTS, requireHost, hostInstructions, renderProtocol, shellQuote };
