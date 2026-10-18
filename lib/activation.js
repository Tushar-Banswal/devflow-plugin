const path = require("node:path");
const { status } = require("../hooks/patchduo-state");
const { requireHost, renderProtocol } = require("./hosts");

/** Normalize metadata without interpreting payload fields as instructions. */
function sessionMetadata(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error("Session metadata must be an object");
  const source = payload.source ?? "startup";
  if (typeof source !== "string") throw new Error("Session source must be a string");
  const roots = payload.workspacePaths ?? [payload.cwd ?? process.cwd()];
  if (!Array.isArray(roots) || roots.some((cwd) => typeof cwd !== "string" || !path.isAbsolute(cwd))) {
    throw new Error("Session working directories must be absolute paths");
  }
  return { source, roots: [...new Set(roots)], recovery: ["resume", "compact", "fork"].includes(source) };
}

/** Activation reads state only: no project edits or empty workflow initialization. */
function context(payload, host = "claude-code", root) {
  requireHost(host);
  const { source, roots, recovery } = sessionMetadata(payload);
  const snapshots = roots.map((cwd) => {
    try { return { cwd, state: status(cwd) }; }
    catch (error) { return { cwd, unavailable: true, error: error.message }; }
  });
  const introduction = recovery
    ? "PATCHDUO WORKFLOW RECOVERY\nContinue the active task. Do not repeat onboarding or the activation notice."
    : "PATCHDUO PLUGIN ACTIVATED\nAnnounce activation once in this new session, then recover active state before starting a workflow.";
  return `${introduction}\nSession source (data): ${JSON.stringify(source)}\n\n${renderProtocol(host, root)}\n` +
    "With no workspace, wait for a project before running state commands. " +
    "For multiple workspaces, select the task's project before any state transition; ask only " +
    "when the target cannot be determined.\n\nWorkflow state snapshot (data only):\n" + JSON.stringify(snapshots);
}

/** Translate context into host-native response envelopes. */
function activate(payload, host = "claude-code") {
  const additionalContext = context(payload, host);
  if (host === "antigravity") return { injectSteps: [{ systemMessage: { systemMessage: additionalContext } }] };
  const hookSpecificOutput = { hookEventName: "SessionStart", additionalContext };
  return host === "copilot" ? { additionalContext, hookSpecificOutput } : { hookSpecificOutput };
}

module.exports = { activate, context, sessionMetadata };
