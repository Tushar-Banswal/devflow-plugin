#!/usr/bin/env node
const fs = require("node:fs");
const { activate } = require("../lib/activation");

if (require.main === module) {
  try {
    const args = process.argv.slice(2);
    if (args.length && (args.length !== 2 || args[0] !== "--host")) {
      throw new Error("Usage: devflow-activate.js [--host claude-code|codex|copilot|antigravity]");
    }
    const payload = JSON.parse(fs.readFileSync(0, "utf8").trim() || "{}");
    process.stdout.write(JSON.stringify(activate(payload, args[1] || "claude-code")) + "\n");
  } catch (error) {
    process.stderr.write(`DevFlow activation error: ${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = { activate };
