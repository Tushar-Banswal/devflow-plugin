// Runs behavioral tests using Node's built-in runner; no dependencies required.
const { spawnSync } = require("node:child_process");
const path = require("node:path");
const result = spawnSync(process.execPath, ["--test", path.join(__dirname, "workflow.test.js")], { stdio: "inherit" });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
