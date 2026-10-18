const fs = require("node:fs");
const path = require("node:path");

const DEFAULTS = { max_iterations: 5, reviewer_model: "default", developer_model: "default" };

/** Read optional shared JSON config, then legacy CLAUDE.md / AGENTS.md blocks. */
function readConfig(root) {
  for (const name of ["patchduo.config.json", "devflow.config.json"]) {
    const jsonFile = path.join(root, name);
    if (!fs.existsSync(jsonFile)) continue;
    const value = JSON.parse(fs.readFileSync(jsonFile, "utf8").replace(/^\uFEFF/, ""));
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error(`${name} must contain an object`);
    }
    for (const key of Object.keys(value)) {
      if (!Object.hasOwn(DEFAULTS, key)) throw new Error(`Unknown ${name} setting: ${key}`);
    }
    const config = { ...DEFAULTS, ...value };
    validateConfig(config);
    return config;
  }
  for (const name of ["CLAUDE.md", "AGENTS.md"]) {
    const file = path.join(root, name);
    if (!fs.existsSync(file)) continue;
    const lines = fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "").split(/\r?\n/);
    const start = ["patchduo", "devflow"].map((brand) =>
      lines.findIndex((line) => new RegExp(`^${brand}:\\s*(?:#.*)?$`).test(line))
    ).find((index) => index >= 0) ?? -1;
    if (start < 0) continue;
    const config = { ...DEFAULTS };
    const seen = new Set();
    for (const line of lines.slice(start + 1)) {
      if (!line.trim() || /^\s*#/.test(line)) continue;
      if (!/^\s/.test(line)) break;
      const match = line.match(/^ {2}([a-z_]+):\s*(?:"([^"\n]*)"|'([^'\n]*)'|([^#\s]+))\s*(?:#.*)?$/);
      if (!match || !Object.hasOwn(DEFAULTS, match[1]) || seen.has(match[1])) {
        throw new Error(`Invalid or duplicate patchduo setting in ${name}: ${line.trim()}`);
      }
      const [, key, doubleQuoted, singleQuoted, bare] = match;
      seen.add(key);
      config[key] = key === "max_iterations" ? Number(doubleQuoted ?? singleQuoted ?? bare) : doubleQuoted ?? singleQuoted ?? bare;
    }
    validateConfig(config);
    return config;
  }
  return { ...DEFAULTS };
}

/** Reject invalid limits and model identifiers before starting a workflow. */
function validateConfig(config) {
  if (!Number.isSafeInteger(config.max_iterations) || config.max_iterations < 1) {
    throw new Error("max_iterations must be a positive safe integer");
  }
  for (const key of ["reviewer_model", "developer_model"]) {
    if (typeof config[key] !== "string" || !/^[a-zA-Z0-9][a-zA-Z0-9._:/-]*$/.test(config[key])) {
      throw new Error(`${key} must be a model identifier or default`);
    }
  }
}

/** Preset models win; user preferences fill only default model entries. */
function resolveConfig(config, preferences = {}) {
  const resolved = { ...config };
  for (const key of ["reviewer_model", "developer_model"]) {
    if (resolved[key] === "default") resolved[key] = preferences[key] || "default";
  }
  validateConfig(resolved);
  return resolved;
}

module.exports = { readConfig, resolveConfig };
