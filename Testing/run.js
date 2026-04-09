const { execSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');

const args = process.argv.slice(2);
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

// Build env for child process
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

const ok = run(`node --test Testing/tier1/*.test.js${reporter}`, 'Tier 1: File Generation Tests');

// Show runs location if --keep was used
if (keep && fs.existsSync(runsDir)) {
  const listDir = (dir, prefix = '') => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        console.log(`  ${prefix}${entry.name}/`);
        listDir(path.join(dir, entry.name), prefix + '  ');
      }
    }
  };
  console.log('\n--- Test artifacts preserved in Testing/runs/ ---');
  listDir(runsDir);
  console.log('\nRun "node Testing/run.js --clean" to remove them.\n');
}

process.exit(ok ? 0 : 1);
