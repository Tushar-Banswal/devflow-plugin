const fs = require("node:fs");
const path = require("node:path");

const CHECKLISTS = ["clean-code", "security", "architectural", "system-design", "senior-architect"];

/** Extract Markdown instructions without copying Claude's agent frontmatter. */
function body(markdown) {
  return markdown.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, "").trim();
}

/** Generate standalone roles, including checklists, from the existing shared sources. */
function rolePrompt(role, root = path.resolve(__dirname, "..")) {
  if (!["reviewer", "developer"].includes(role)) throw new Error(`Unknown role: ${role}`);
  const packaged = path.join(root, "resources/roles", `${role}.md`);
  if (fs.existsSync(packaged)) return fs.readFileSync(packaged, "utf8");
  const persona = body(fs.readFileSync(path.join(root, "agents", `${role}.md`), "utf8"))
    .replace(/patchduo:([a-z][a-z-]*)/g, "patchduo-$1")
    .replaceAll("with `Glob`", "using native read-only file search")
    .replaceAll("(no Edit, Write, MultiEdit)", "(no editing tools)");
  const checklists = role === "developer" ? ["clean-code"] : CHECKLISTS;
  return `${persona}\n\nThe complete checklists follow; apply these directly.\n\n` +
    checklists.map((name) => `## patchduo-${name}\n\n${body(fs.readFileSync(path.join(root, "skills", name, "SKILL.md"), "utf8"))}`)
      .join("\n\n").replace(/patchduo:([a-z][a-z-]*)/g, "patchduo-$1") + "\n";
}

module.exports = { CHECKLISTS, body, rolePrompt };
