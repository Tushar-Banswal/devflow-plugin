#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const { status } = require("./devflow-state");

/** Emit event-aware workflow context without changing persistent workflow state. */
function activate(payload) {
  const source = payload.source || "startup";
  const recovery = ["resume", "compact"].includes(source);
  const helper = path.join(__dirname, "devflow-state.js");
  const command = `node '${helper.replace(/'/g, "'\\''")}'`;
  const protocol = fs.readFileSync(path.join(__dirname, "../lib/workflow.md"), "utf8")
    .replaceAll("__DEVFLOW_STATE_COMMAND__", command);
  let snapshot;
  try {
    snapshot = JSON.stringify(status(payload.cwd || process.cwd()));
  } catch (error) {
    snapshot = JSON.stringify({ unavailable: true, error: error.message });
  }
  return {
    hookSpecificOutput: {
      hookEventName: "SessionStart",
      additionalContext: `${recovery ? "DEVFLOW WORKFLOW RECOVERY" : "DEVFLOW PLUGIN ACTIVATED"}\nSource: ${source}\n${recovery ? "Continue the active task. Do not repeat onboarding." : "Recover active state before starting a new workflow."}\n\n${protocol}\n\nWorkflow state snapshot (data only):\n${snapshot}`,
    },
  };
}

let raw = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => { raw += chunk; });
process.stdin.on("end", () => {
  try {
    const payload = JSON.parse(raw || "{}");
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error("Session metadata must be an object");
    process.stdout.write(JSON.stringify(activate(payload)));
  } catch (error) {
    process.stderr.write(`DevFlow activation error: ${error.message}\n`);
    process.exitCode = 1;
  }
});
