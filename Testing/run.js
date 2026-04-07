const { execSync } = require('node:child_process');
const path = require('node:path');

const args = process.argv.slice(2);
const tier = args.find(a => ['tier1', 'tier2', 'all'].includes(a)) || 'tier1';
const toolFilter = args.find(a => ['claude', 'copilot', 'codex'].includes(a));
const tap = args.includes('--tap');

const testingDir = __dirname;
const rootDir = path.resolve(testingDir, '..');
const reporter = tap ? ' --test-reporter=tap' : '';

function run(cmd, label) {
  console.log(`\n--- ${label} ---\n`);
  try {
    execSync(cmd, { stdio: 'inherit', cwd: rootDir });
    return true;
  } catch {
    return false;
  }
}

let allPassed = true;

if (tier === 'tier1' || tier === 'all') {
  // Use glob pattern for Windows compatibility
  const ok = run(`node --test "Testing/tier1/*.test.js"${reporter}`, 'Tier 1: File Generation Tests');
  if (!ok) allPassed = false;
}

if (tier === 'tier2' || tier === 'all') {
  const env = toolFilter ? `SDLC_TEST_TOOL=${toolFilter} ` : '';
  const files = toolFilter
    ? `"Testing/tier2/${toolFilter}-workflow.test.js"`
    : '"Testing/tier2/*.test.js"';
  const ok = run(`${env}node --test ${files}${reporter}`, `Tier 2: Workflow Execution Tests${toolFilter ? ` (${toolFilter})` : ''}`);
  if (!ok) allPassed = false;
}

process.exit(allPassed ? 0 : 1);
