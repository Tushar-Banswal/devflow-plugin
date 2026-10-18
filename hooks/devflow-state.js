#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");
const { readConfig, resolveConfig } = require("../lib/config");

/** Execute Git without a shell and bound subprocess time and output. */
function git(args, cwd) {
  return execFileSync("git", args, { cwd, timeout: 5000, maxBuffer: 32 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] });
}

/** Resolve per-worktree state storage outside the working tree. */
function location(cwd) {
  const root = git(["rev-parse", "--show-toplevel"], cwd).toString().trim();
  const file = path.resolve(root, git(["rev-parse", "--git-path", "devflow/state.json"], root).toString().trim());
  return { root, file };
}

/** Hash HEAD, tracked changes, and non-ignored untracked file contents. */
function fingerprint(root) {
  const hash = crypto.createHash("sha256");
  hash.update(git(["rev-parse", "HEAD"], root));
  for (const args of [["diff", "--cached", "HEAD"], ["diff"]]) {
    const diff = git([...args, "--binary", "--no-ext-diff", "--no-textconv", "--"], root);
    hash.update(`${diff.length}:`);
    hash.update(diff);
  }
  const names = git(["ls-files", "--others", "--exclude-standard", "-z"], root).toString().split("\0").filter(Boolean).sort();
  for (const name of names) {
    const file = path.join(root, name);
    const stat = fs.lstatSync(file);
    if (!stat.isFile() && !stat.isSymbolicLink()) throw new Error(`Cannot fingerprint special file: ${name}`);
    const content = stat.isSymbolicLink() ? Buffer.from(fs.readlinkSync(file)) : fs.readFileSync(file);
    hash.update(JSON.stringify([name, stat.mode, content.length]));
    hash.update(content);
  }
  return hash.digest("hex");
}

function requirePhase(state, phases) {
  if (!state || !phases.includes(state.phase)) throw new Error(`Expected phase ${phases.join(" or ")}; got ${state?.phase || "no workflow"}`);
}

function requireText(value, field) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${field} must be a non-empty string`);
}

/** Validate one workflow transition; callers persist only successful results. */
function transition(state, command, input, root) {
  if (command === "init") {
    if (state && !["approved", "escalated", "cancelled"].includes(state.phase)) throw new Error("A workflow is already active; resume it instead of resetting its counter");
    requireText(input.goal, "goal");
    const startingHead = git(["rev-parse", "--verify", "HEAD"], root).toString().trim();
    return { version: 1, startingHead, goal: input.goal, config: resolveConfig(readConfig(root), input), phase: "planning", iteration: 0 };
  }
  if (command === "cancel") {
    requirePhase(state, ["planning", "ready", "implementing", "reviewing", "rejected"]);
    requireText(input.reason, "reason");
    return { ...state, phase: "cancelled", cancellation: input.reason };
  }
  if (command === "brief") {
    requirePhase(state, ["planning"]);
    requireText(input.brief, "brief");
    return { ...state, brief: input.brief, phase: "ready" };
  }
  if (command === "implement") {
    requirePhase(state, ["ready", "rejected"]);
    if (state.iteration >= state.config.max_iterations) throw new Error("Iteration limit reached; escalate to the user");
    return { ...state, phase: "implementing", iteration: state.iteration + 1 };
  }
  if (command === "review") {
    requirePhase(state, ["implementing"]);
    return { ...state, phase: "reviewing", fingerprint: fingerprint(root) };
  }
  if (command === "verdict") {
    requirePhase(state, ["reviewing"]);
    if (fingerprint(root) !== state.fingerprint) throw new Error("Files changed during review; run refresh-review and review the new snapshot");
    if (!["APPROVED", "REJECTED"].includes(input.result) || !Array.isArray(input.issues)) throw new Error("Verdict requires result APPROVED or REJECTED and an issues array");
    requireText(input.summary, "summary");
    if (input.result === "APPROVED" && input.issues.length) throw new Error("APPROVED verdict cannot contain issues");
    if (input.result === "REJECTED" && (!input.issues.length || input.issues.some((issue) => typeof issue !== "string" || !/^.+:[1-9]\d*\s+[—-]\s+\S/.test(issue)))) throw new Error("REJECTED verdict requires non-empty issue strings with file references");
    const phase = input.result === "APPROVED" ? "approved" : state.iteration >= state.config.max_iterations ? "escalated" : "rejected";
    return { ...state, phase, verdict: input };
  }
  if (command === "refresh-review") {
    requirePhase(state, ["reviewing"]);
    return { ...state, fingerprint: fingerprint(root) };
  }
  throw new Error(`Unknown command: ${command}`);
}

/** Reconstruct review evidence from the original commit, including committed work. */
function evidence(state, root) {
  if (!state || typeof state.startingHead !== "string" || !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(state.startingHead)) {
    throw new Error("Workflow has no starting commit; its review scope cannot be reconstructed. Do not substitute current HEAD; ask the user how to recover or restart the workflow.");
  }
  git(["rev-parse", "--verify", `${state.startingHead}^{commit}`], root);
  const head = git(["rev-parse", "--verify", "HEAD"], root).toString().trim();
  const diff = (args) => git(["diff", ...args, "--binary", "--no-ext-diff", "--no-textconv", "--"], root).toString();
  return {
    startingHead: state.startingHead,
    head,
    committedDiff: diff([state.startingHead, head]),
    stagedDiff: diff(["--cached", head]),
    unstagedDiff: diff([]),
    untrackedFiles: git(["ls-files", "--others", "--exclude-standard", "-z"], root).toString().split("\0").filter(Boolean).sort(),
  };
}

/** Read workflow state, reporting stale approval without changing its audit record. */
function status(cwd) {
  const { root, file } = location(cwd);
  if (!fs.existsSync(file)) return null;
  const state = JSON.parse(fs.readFileSync(file, "utf8"));
  if (state.phase === "approved" && fingerprint(root) !== state.fingerprint) return { ...state, phase: "stale", recordedPhase: "approved" };
  return state;
}

/** Serialize transitions and atomically replace the state file. */
function execute(command, input, cwd) {
  if (command === "status") return status(cwd);
  if (command === "config") return readConfig(location(cwd).root);
  const { root, file } = location(cwd);
  if (command === "evidence") {
    const state = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : null;
    return evidence(state, root);
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const lock = `${file}.lock`;
  const handle = fs.openSync(lock, "wx");
  const temporary = `${file}.${process.pid}.tmp`;
  try {
    const state = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : null;
    const next = transition(state, command, input, root);
    fs.writeFileSync(temporary, JSON.stringify(next, null, 2), { mode: 0o600 });
    fs.renameSync(temporary, file);
    return next;
  } finally {
    fs.rmSync(temporary, { force: true });
    fs.closeSync(handle);
    fs.unlinkSync(lock);
  }
}

if (require.main === module) {
  try {
    const raw = fs.readFileSync(0, "utf8").trim();
    const input = raw ? JSON.parse(raw) : {};
    if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Input must be a JSON object");
    process.stdout.write(JSON.stringify(execute(process.argv[2], input, process.cwd())) + "\n");
  } catch (error) {
    process.stderr.write(`DevFlow state error: ${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = { execute, status, fingerprint };
