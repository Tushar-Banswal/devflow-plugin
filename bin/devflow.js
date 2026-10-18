#!/usr/bin/env node
const fs = require("node:fs");
const { requireHost } = require("../lib/hosts");
const { context } = require("../lib/activation");
const { registerCodex } = require("../lib/setup");

/** Parse the deliberately small public CLI without dependencies or shell evaluation. */
function main(args) {
  const [command, ...options] = args;
  if (!command || command === "--help") {
    return "DevFlow\n  context --host HOST     Read activation context (JSON metadata on stdin)\n" +
      "  setup --host codex [--dry-run]      Register user-level Codex agents\n" +
      "  uninstall --host codex [--dry-run]  Remove unchanged DevFlow-owned profiles\n";
  }
  let host;
  let dryRun = false;
  for (let index = 0; index < options.length; index++) {
    if (options[index] === "--host" && !host) host = requireHost(options[++index]);
    else if (options[index] === "--dry-run" && !dryRun) dryRun = true;
    else throw new Error(`Unknown or duplicate option: ${options[index]}`);
  }
  if (!host) throw new Error("--host is required");
  if (command === "context" && !dryRun) {
    const raw = fs.readFileSync(0, "utf8").trim();
    return context(raw ? JSON.parse(raw) : {}, host) + "\n";
  }
  if (["setup", "uninstall"].includes(command) && host === "codex") {
    return JSON.stringify(registerCodex({ remove: command === "uninstall", dryRun }), null, 2) + "\n";
  }
  throw new Error("Use context --host HOST, or setup/uninstall --host codex; other hosts use native plugin registration");
}

if (require.main === module) {
  try { process.stdout.write(main(process.argv.slice(2))); }
  catch (error) { process.stderr.write(`DevFlow error: ${error.message}\n`); process.exitCode = 1; }
}

module.exports = { main };
