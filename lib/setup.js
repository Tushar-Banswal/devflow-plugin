const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");
const { rolePrompt } = require("./personas");

const ROLES = ["reviewer", "developer"];
const FILES = ROLES.map((role) => `patchduo-${role}.toml`);
const hash = (value) => crypto.createHash("sha256").update(value).digest("hex");

/** Render a standalone Codex profile; it does not depend on a plugin cache path. */
function codexProfile(role) {
  return `name = "patchduo-${role}"\ndescription = "PatchDuo ${role.toUpperCase()} workflow agent"\n` +
    `developer_instructions = ${JSON.stringify(rolePrompt(role))}\n`;
}

/** Refuse symlinks rather than overwrite a user-managed registration or agent. */
function regularFile(file) {
  const stat = fs.lstatSync(file, { throwIfNoEntry: false });
  if (!stat) return null;
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`Refusing non-regular file: ${file}`);
  return fs.readFileSync(file);
}

/** Register or clean up only PatchDuo-owned Codex profiles; never change project files. */
function registerCodex({ remove = false, dryRun = false, codexHome = process.env.CODEX_HOME || path.join(os.homedir(), ".codex") } = {}) {
  const root = path.resolve(codexHome);
  const agents = path.join(root, "agents");
  const directory = path.join(root, "patchduo");
  const manifest = path.join(directory, "registration.json");
  for (const dir of [agents, directory]) {
    const stat = fs.lstatSync(dir, { throwIfNoEntry: false });
    if (stat && (!stat.isDirectory() || stat.isSymbolicLink())) throw new Error(`Refusing non-directory or symlink: ${dir}`);
  }
  if (remove && !fs.existsSync(manifest)) return { action: "uninstall", dryRun, files: [] };
  const lock = path.join(directory, "registration.lock");
  let handle;
  if (!dryRun) {
    fs.mkdirSync(directory, { recursive: true });
    handle = fs.openSync(lock, "wx", 0o600);
  }
  try {
    const raw = regularFile(manifest);
    const prior = raw ? JSON.parse(raw) : { version: 1, host: "codex", files: {} };
    if (!prior || prior.version !== 1 || prior.host !== "codex" || !prior.files || typeof prior.files !== "object" ||
        Array.isArray(prior.files) || Object.entries(prior.files).some(([name, digest]) => !FILES.includes(name) || !/^[a-f0-9]{64}$/.test(digest))) {
      throw new Error("Invalid PatchDuo registration manifest; preserve it and resolve before setup");
    }
    const changes = FILES.map((name, index) => {
      const file = path.join(agents, name);
      const previous = regularFile(file);
      if (previous && (!prior.files[name] || hash(previous) !== prior.files[name])) {
        throw new Error(`User-modified or unowned profile: ${file}; no files changed`);
      }
      return { file, name, previous, content: remove ? null : codexProfile(ROLES[index]) };
    });
    if (dryRun) return { action: remove ? "uninstall" : "setup", dryRun, files: changes.map(({ file }) => file) };
    fs.mkdirSync(agents, { recursive: true });
    const written = [];
    try {
      for (const change of changes) {
        if (remove) fs.rmSync(change.file, { force: true });
        else atomicWrite(change.file, change.content);
        written.push(change);
      }
      if (remove) fs.rmSync(manifest);
      else atomicWrite(manifest, JSON.stringify({ version: 1, host: "codex", files: Object.fromEntries(changes.map((change) => [change.name, hash(change.content)])) }, null, 2) + "\n");
    } catch (error) {
      for (const change of written.reverse()) {
        if (change.previous) atomicWrite(change.file, change.previous);
        else fs.rmSync(change.file, { force: true });
      }
      throw error;
    }
    return { action: remove ? "uninstall" : "setup", dryRun, files: changes.map(({ file }) => file) };
  } finally {
    if (handle !== undefined) {
      fs.closeSync(handle);
      fs.unlinkSync(lock);
    }
  }
}

/** Replace one generated file without exposing a partially written profile. */
function atomicWrite(file, content) {
  const temporary = `${file}.${crypto.randomUUID()}.tmp`;
  const handle = fs.openSync(temporary, "wx", 0o600);
  try {
    try { fs.writeFileSync(handle, content); }
    finally { fs.closeSync(handle); }
    fs.renameSync(temporary, file);
  } finally {
    fs.rmSync(temporary, { force: true });
  }
}

module.exports = { registerCodex, codexProfile };
