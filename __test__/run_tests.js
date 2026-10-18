// Runs behavioral tests using Node's built-in runner; no dependencies required.
const { spawnSync } = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs");
const files = fs.readdirSync(__dirname).filter((name) => name.endsWith(".test.js")).sort();
const result = spawnSync(process.execPath, ["--test", ...files.map((name) => path.join(__dirname, name))], { stdio: "inherit" });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
