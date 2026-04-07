const { execSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');

const args = process.argv.slice(2);
const tier = args.find(a => ['tier1', 'tier2', 'all'].includes(a)) || 'tier1';
const toolFilter = args.find(a => ['claude', 'copilot', 'codex'].includes(a));
const tap = args.includes('--tap');
const keep = args.includes('--keep');
const clean = args.includes('--clean');

const testingDir = __dirname;
const rootDir = path.resolve(testingDir, '..');
const runsDir = path.join(testingDir, 'runs');
const reporter = tap ? ' --test-reporter=tap' : '';

// --clean: remove all previous test runs and exit
if (clean) {
  if (fs.existsSync(runsDir)) {
    fs.rmSync(runsDir, { recursive: true, force: true });
    console.log('Removed Testing/runs/');
  } else {
    console.log('Testing/runs/ does not exist');
  }
  process.exit(0);
}

// Pass SDLC_TEST_KEEP to child process so cleanup() preserves folders
const env = { ...process.env };
if (keep) env.SDLC_TEST_KEEP = '1';

function run(cmd, label) {
  console.log(`\n--- ${label} ---\n`);
  try {
    execSync(cmd, { stdio: 'inherit', cwd: rootDir, env });
    return true;
  } catch {
    return false;
  }
}

let allPassed = true;

if (tier === 'tier1' || tier === 'all') {
  const ok = run(`node --test "Testing/tier1/*.test.js"${reporter}`, 'Tier 1: File Generation Tests');
  if (!ok) allPassed = false;
}

if (tier === 'tier2' || tier === 'all') {
  if (toolFilter) env.SDLC_TEST_TOOL = toolFilter;
  const files = toolFilter
    ? `"Testing/tier2/${toolFilter}-workflow.test.js"`
    : '"Testing/tier2/*.test.js"';
  const ok = run(`node --test ${files}${reporter}`, `Tier 2: Workflow Execution Tests${toolFilter ? ` (${toolFilter})` : ''}`);
  if (!ok) allPassed = false;
}

// Show runs location if --keep was used
if (keep && fs.existsSync(runsDir)) {
  const runs = fs.readdirSync(runsDir).sort();
  console.log(`\n--- Test artifacts preserved in Testing/runs/ (${runs.length} folders) ---`);
  for (const r of runs) console.log(`  ${r}`);
  console.log('\nRun "node Testing/run.js --clean" to remove them.\n');
}

process.exit(allPassed ? 0 : 1);
