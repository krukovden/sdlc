'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const SDLC_ROOT = path.resolve(__dirname, '..', '..');
const RUNS_DIR = path.join(SDLC_ROOT, 'Testing', 'runs');

/**
 * Recursively copy a directory from src to dest.
 */
function copyDirSync(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * Create a temporary test project directory for tier 1 tests.
 *
 * Copies .sdlc/, setup.js, bin/ from the SDLC package root,
 * then runs `sdlc init <tool>` to generate platform config files.
 *
 * @param {object} options
 * @param {string} [options.tool]       - Platform to init (claude/copilot/codex)
 * @returns {Promise<{ dir: string, workflowsDir: string, cleanup: () => void }>}
 */
async function create({ tool } = {}) {
  const timestamp = Date.now();
  const label = tool || 'base';
  const dir = path.join(RUNS_DIR, `tier1-${timestamp}-${label}`);

  fs.mkdirSync(dir, { recursive: true });

  // Copy .sdlc/, setup.js, bin/, package.json from SDLC_ROOT
  // These are the package files that setup.js reads during init
  copyDirSync(path.join(SDLC_ROOT, '.sdlc'), path.join(dir, '.sdlc'));
  fs.copyFileSync(path.join(SDLC_ROOT, 'setup.js'), path.join(dir, 'setup.js'));
  copyDirSync(path.join(SDLC_ROOT, 'bin'), path.join(dir, 'bin'));
  // server files live under .agents/assets/server/ — already copied by the .agents copyDirSync above
  fs.copyFileSync(path.join(SDLC_ROOT, 'package.json'), path.join(dir, 'package.json'));

  // 5. If tool is specified: run `node bin/sdlc.js init <tool>` in the temp dir
  if (tool) {
    execFileSync(process.execPath, ['bin/sdlc.js', 'init', tool], {
      cwd: dir,
      stdio: 'pipe',
      env: {
        ...process.env,
        SDLC_PACKAGE_DIR: dir,
        SDLC_COMMAND: 'init',
      },
    });
  }

  // 6. Return result
  const workflowsDir = path.join(dir, 'sdlc-doc', 'workflows');

  // SDLC_TEST_KEEP=1 preserves run folders for inspection
  function cleanup() {
    if (!process.env.SDLC_TEST_KEEP) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }

  return { dir, workflowsDir, cleanup };
}

module.exports = { create, SDLC_ROOT };
