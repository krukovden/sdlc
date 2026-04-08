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
 * Create a test project directory.
 *
 * Tier 1: Testing/runs/tier1-<timestamp>-<label>/
 * Tier 2: Testing/runs/<tool>/<workflow>-<YYYYMMDD-HHmmss>/
 *
 * @param {object} options
 * @param {number} [options.tier=1]     - 1 or 2; tier 2 also copies fixture project
 * @param {string} [options.tool]       - Platform to init (claude/copilot/codex)
 * @param {string} [options.workflow]   - Workflow type (feature/bugfix/refactor/spike) — tier2 only
 * @returns {Promise<{ dir: string, workflowsDir: string, cleanup: () => void }>}
 */
async function create({ tier = 1, tool, workflow } = {}) {
  let dir;

  if (tier === 2 && tool && workflow) {
    // Tier 2 new structure: runs/<tool>/<workflow>-<YYYYMMDD-HHmmss>/
    const ts = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
    dir = path.join(RUNS_DIR, tool, `${workflow}-${ts}`);
  } else {
    // Tier 1 / fallback structure
    const timestamp = Date.now();
    const label = tool || 'base';
    dir = path.join(RUNS_DIR, `tier${tier}-${timestamp}-${label}`);
  }

  fs.mkdirSync(dir, { recursive: true });

  // 2. Copy .agents/ from SDLC_ROOT
  const agentsSrc = path.join(SDLC_ROOT, '.agents');
  const agentsDest = path.join(dir, '.agents');
  copyDirSync(agentsSrc, agentsDest);

  // 3. Copy setup.js, bin/sdlc.js, AGENTS.md, package.json from SDLC_ROOT
  fs.copyFileSync(path.join(SDLC_ROOT, 'setup.js'), path.join(dir, 'setup.js'));

  const binSrc = path.join(SDLC_ROOT, 'bin');
  const binDest = path.join(dir, 'bin');
  copyDirSync(binSrc, binDest);

  fs.copyFileSync(path.join(SDLC_ROOT, 'AGENTS.md'), path.join(dir, 'AGENTS.md'));
  fs.copyFileSync(path.join(SDLC_ROOT, 'package.json'), path.join(dir, 'package.json'));

  // 4. If tier === 2: also copy Testing/fixtures/test-project/ contents (silently skip if missing)
  if (tier === 2) {
    const fixtureSrc = path.join(SDLC_ROOT, 'Testing', 'fixtures', 'test-project');
    if (fs.existsSync(fixtureSrc)) {
      copyDirSync(fixtureSrc, dir);
    }
  }

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
  const workflowsDir = path.join(dir, 'docs', 'workflows');

  // SDLC_TEST_KEEP=1 preserves run folders for inspection
  function cleanup() {
    if (!process.env.SDLC_TEST_KEEP) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }

  return { dir, workflowsDir, cleanup };
}

module.exports = { create, SDLC_ROOT };
