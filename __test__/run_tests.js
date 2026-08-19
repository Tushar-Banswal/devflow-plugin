// run_tests.js -- DevFlow plugin test harness
//
// What these tests cover (no live Claude session required):
//   1. Hook script -- verifies the activation JSON output structure and required strings
//   2. Plugin files -- verifies all required files exist and are non-empty
//   3. Front-matter -- verifies name: is present in every skill YAML header
//
// End-to-end session test (manual):
//   Run `claude --plugin-dir .` from the PARENT directory of devflow-plugin, then send
//   a task and verify the REVIEWER -> DEVELOPER loop executes and ends with APPROVED.
//   Expected strings are listed in __test__/expected_output.txt.

const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
let passed = 0;
let failed = 0;

function pass(label) {
  console.log("  OK  " + label);
  passed++;
}

function fail(label, detail) {
  console.error("  FAIL  " + label);
  if (detail) console.error("        " + detail);
  failed++;
}

function section(title) {
  console.log("\n-- " + title);
}

// ---------------------------------------------------------------------------
// 1. Hook script output
// ---------------------------------------------------------------------------
section("Hook script -- activation JSON");

(function () {
  const hookPath = path.join(ROOT, "hooks", "devflow-activate.js");

  let output;
  try {
    output = execFileSync(process.execPath, [hookPath], {
      input: "{}",
      stdio: ["pipe", "pipe", "pipe"],
    }).toString();
  } catch (e) {
    fail("Hook script exits 0", e.message);
    return;
  }

  pass("Hook script exits 0");

  let parsed;
  try {
    parsed = JSON.parse(output);
    pass("Output is valid JSON");
  } catch (_) {
    fail("Output is valid JSON", "Raw output: " + output.slice(0, 120));
    return;
  }

  var ctx =
    (parsed &&
      parsed.hookSpecificOutput &&
      parsed.hookSpecificOutput.additionalContext) ||
    "";

  var requiredStrings = [
    "DEVFLOW PLUGIN ACTIVATED",
    "Which model should I use",
    "Implementation Brief",
    "REVIEWER",
    "DEVELOPER",
    "Phase 1",
    "Phase 2",
    "Phase 3",
    "Phase 4",
  ];

  requiredStrings.forEach(function (str) {
    if (ctx.indexOf(str) !== -1) {
      pass('Activation prompt contains "' + str + '"');
    } else {
      fail('Activation prompt contains "' + str + '"');
    }
  });
})();

// ---------------------------------------------------------------------------
// 2. Required plugin files exist and are non-empty
// ---------------------------------------------------------------------------
section("Plugin file presence");

var requiredFiles = [
  ".claude-plugin/plugin.json",
  ".claude-plugin/marketplace.json",
  "hooks/hooks.json",
  "hooks/devflow-activate.js",
  "agents/developer.md",
  "agents/reviewer.md",
  "skills/clean-code/SKILL.md",
  "skills/security/SKILL.md",
  "skills/architectural/SKILL.md",
  "skills/system-design/SKILL.md",
  "skills/senior-architect/SKILL.md",
  "skills/developer/SKILL.md",
  "skills/reviewer/SKILL.md",
  "README.md",
  "package.json",
];

requiredFiles.forEach(function (rel) {
  var abs = path.join(ROOT, rel);
  if (fs.existsSync(abs) && fs.statSync(abs).size > 0) {
    pass(rel);
  } else {
    fail(rel, "Missing or empty");
  }
});

// ---------------------------------------------------------------------------
// 3. YAML front-matter -- name: field required in all skill files
// ---------------------------------------------------------------------------
section("SKILL.md front-matter -- name: field");

var skillFiles = [
  "skills/clean-code/SKILL.md",
  "skills/security/SKILL.md",
  "skills/architectural/SKILL.md",
  "skills/system-design/SKILL.md",
  "skills/senior-architect/SKILL.md",
  "skills/developer/SKILL.md",
  "skills/reviewer/SKILL.md",
];

skillFiles.forEach(function (rel) {
  var abs = path.join(ROOT, rel);
  var content = fs.readFileSync(abs, "utf8");
  // Extract YAML front-matter between first pair of ---
  var fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (fmMatch && /^name:\s*\S/m.test(fmMatch[1])) {
    pass(rel + " has name:");
  } else {
    fail(rel + " has name:", "Missing name: field in YAML front-matter");
  }
});

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------
console.log("\n----------------------------------------");
console.log("Total: " + (passed + failed) + "  OK: " + passed + "  FAIL: " + failed);

if (failed > 0) {
  process.exit(1);
}
