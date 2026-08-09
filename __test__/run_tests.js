// run_tests.js – Cross‑platform test harness for DevFlow plugin
// This script creates a temporary project, installs the plugin via the self‑hosted marketplace,
// runs a Claude session, and verifies that the core review loop executes.

const { execSync, execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Helper to run a command and capture stdout+stderr
function run(cmd, args = [], opts = {}) {
  try {
    const result = execFileSync(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], ...opts });
    return result.toString();
  } catch (e) {
    console.error(`❌ Command failed: ${cmd} ${args.join(' ')}`);
    console.error(e.stderr ? e.stderr.toString() : e.message);
    process.exit(1);
  }
}

(async () => {
  // 1️⃣ Create temporary test directory
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'devflow-test-'));
  console.log(`🗂️  Using temporary folder: ${tmpDir}`);

  // 2️⃣ Initialise minimal repo
  process.chdir(tmpDir);
  run('git', ['init', '-q']);
  fs.writeFileSync('add.js', `export function add(a, b) {\n  return a + b;\n}\n`);
  fs.writeFileSync('CLAUDE.md', `devflow:\n  max_iterations: 2\n  reviewer_model: default\n  developer_model: default\n`);

  // 3️⃣ Install the plugin via self‑hosted marketplace
  console.log('🔌 Adding marketplace and installing plugin...');
  run('claude', ['/plugin', 'marketplace', 'add', 'Tushar-Banswal/devflow-plugin']);
  run('claude', ['/plugin', 'install', 'devflow@devflow']);
  run('claude', ['/reload-plugins']);

  // 4️⃣ Run a non‑interactive Claude session
  // The `--no-interactive` flag forces default answers to model‑preference prompts.
  const outputFile = path.join(tmpDir, 'session_output.txt');
  console.log('🚀 Running Claude session...');
  run('claude', [
    '--no-interactive',
    '--plugin-dir', '.',
    '--prompt', 'Create a function that multiplies two numbers',
    '--output-file', outputFile
  ]);

  // 5️⃣ Verify required strings are present
  const output = fs.readFileSync(outputFile, 'utf8');
  const required = [
    'DevFlow active',
    'Which model should I use',
    'Implementation Brief',
    'APPROVED'
  ];
  const missing = required.filter(str => !output.includes(str));

  if (missing.length === 0) {
    console.log('✅ All verification strings found – test passed');
  } else {
    console.error('❌ Missing expected output:', missing.join(', '));
    process.exit(1);
  }

  // 6️⃣ Cleanup (optional – keep for debugging)
  // Uncomment the line below to delete the temporary folder after the run.
  // fs.rmSync(tmpDir, { recursive: true, force: true });
})();
