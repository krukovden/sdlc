'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const { create } = require('../helpers/temp-project');
const { assertFileContains } = require('../helpers/file-assertions');

// ─── auto-detect: updates all installed platforms ───────────────────────────

describe('-u auto-detect: updates installed platforms', () => {
  let proj;

  before(async () => {
    proj = await create({ tool: 'all' });
    fs.appendFileSync(
      path.join(proj.dir, '.sdlc', 'skills', 'architect', 'SKILL.md'),
      '\n<!-- test-update-marker -->',
    );
    execFileSync(process.execPath, ['bin/sdlc.js', '-u'], {
      cwd: proj.dir,
      stdio: 'pipe',
      env: { ...process.env, SDLC_PACKAGE_DIR: proj.dir },
    });
  });

  after(() => proj.cleanup());

  it('updates .claude/skills/SKILL.architect.md with the skill change', () => {
    assertFileContains(proj.dir, '.claude/skills/SKILL.architect.md', '<!-- test-update-marker -->');
  });

  it('preserves .sdlc/ — does not overwrite project skill', () => {
    assertFileContains(proj.dir, '.sdlc/skills/architect/SKILL.md', '<!-- test-update-marker -->');
  });
});

// ─── -u claude: only regenerates .claude/ ───────────────────────────────────

describe('-u claude: only updates .claude/', () => {
  let proj;

  before(async () => {
    proj = await create({ tool: 'all' });

    // Mark .github/ to detect accidental regeneration
    fs.appendFileSync(
      path.join(proj.dir, '.github', 'copilot-instructions.md'),
      '\n<!-- should-survive-claude-update -->',
    );

    // Modify skill so .claude/ skill content changes
    fs.appendFileSync(
      path.join(proj.dir, '.sdlc', 'skills', 'architect', 'SKILL.md'),
      '\n<!-- claude-only-marker -->',
    );

    execFileSync(process.execPath, ['bin/sdlc.js', '-u', 'claude'], {
      cwd: proj.dir,
      stdio: 'pipe',
      env: { ...process.env, SDLC_PACKAGE_DIR: proj.dir },
    });
  });

  after(() => proj.cleanup());

  it('updates .claude/skills/SKILL.architect.md', () => {
    assertFileContains(proj.dir, '.claude/skills/SKILL.architect.md', '<!-- claude-only-marker -->');
  });

  it('does not modify .github/copilot-instructions.md', () => {
    assertFileContains(proj.dir, '.github/copilot-instructions.md', '<!-- should-survive-claude-update -->');
  });
});

// ─── --update long form ──────────────────────────────────────────────────────

describe('--update long form works', () => {
  let proj;

  before(async () => {
    proj = await create({ tool: 'claude' });
    fs.appendFileSync(
      path.join(proj.dir, '.sdlc', 'skills', 'architect', 'SKILL.md'),
      '\n<!-- long-form-marker -->',
    );
    execFileSync(process.execPath, ['bin/sdlc.js', '--update'], {
      cwd: proj.dir,
      stdio: 'pipe',
      env: { ...process.env, SDLC_PACKAGE_DIR: proj.dir },
    });
  });

  after(() => proj.cleanup());

  it('updates .claude/ skill with --update flag', () => {
    assertFileContains(proj.dir, '.claude/skills/SKILL.architect.md', '<!-- long-form-marker -->');
  });
});

// ─── -u all: explicit all ────────────────────────────────────────────────────

describe('-u all: explicit all updates all platforms', () => {
  let proj;

  before(async () => {
    proj = await create({ tool: 'all' });
    fs.appendFileSync(
      path.join(proj.dir, '.sdlc', 'skills', 'architect', 'SKILL.md'),
      '\n<!-- all-marker -->',
    );
    execFileSync(process.execPath, ['bin/sdlc.js', '-u', 'all'], {
      cwd: proj.dir,
      stdio: 'pipe',
      env: { ...process.env, SDLC_PACKAGE_DIR: proj.dir },
    });
  });

  after(() => proj.cleanup());

  it('updates .claude/ skill', () => {
    assertFileContains(proj.dir, '.claude/skills/SKILL.architect.md', '<!-- all-marker -->');
  });
});

// ─── error: no .sdlc/ in project ──────────────────────────────────────────

describe('error: no .sdlc/ in project', () => {
  let exitCode;
  let output;
  let proj;

  before(async () => {
    proj = await create({});
    fs.rmSync(path.join(proj.dir, '.sdlc'), { recursive: true, force: true });
    try {
      execFileSync(process.execPath, ['bin/sdlc.js', '-u'], {
        cwd: proj.dir,
        stdio: 'pipe',
        env: { ...process.env, SDLC_PACKAGE_DIR: proj.dir },
      });
      exitCode = 0;
    } catch (err) {
      exitCode = err.status;
      output = (err.stderr?.toString() ?? '') + (err.stdout?.toString() ?? '');
    }
  });

  after(() => proj.cleanup());

  it('exits with code 1', () => {
    assert.strictEqual(exitCode, 1);
  });

  it('prints message referencing .sdlc/', () => {
    assert.ok(output.includes('.sdlc/'), `Expected .sdlc/ in output, got: ${output}`);
  });
});

// ─── error: no platform directories ─────────────────────────────────────────

describe('error: no platform directories found', () => {
  let exitCode;
  let output;
  let proj;

  before(async () => {
    proj = await create({}); // .sdlc/ exists, no platform dirs
    try {
      execFileSync(process.execPath, ['bin/sdlc.js', '-u'], {
        cwd: proj.dir,
        stdio: 'pipe',
        env: { ...process.env, SDLC_PACKAGE_DIR: proj.dir },
      });
      exitCode = 0;
    } catch (err) {
      exitCode = err.status;
      output = (err.stderr?.toString() ?? '') + (err.stdout?.toString() ?? '');
    }
  });

  after(() => proj.cleanup());

  it('exits with code 1', () => {
    assert.strictEqual(exitCode, 1);
  });

  it('prints message about missing platform directories', () => {
    assert.ok(
      output.includes('No platform directories found'),
      `Expected 'No platform directories found' in output, got: ${output}`,
    );
  });
});

// ─── error: unknown platform argument ───────────────────────────────────────

describe('error: unknown platform argument', () => {
  let exitCode;
  let output;
  let proj;

  before(async () => {
    proj = await create({ tool: 'claude' });
    try {
      execFileSync(process.execPath, ['bin/sdlc.js', '-u', 'vscode'], {
        cwd: proj.dir,
        stdio: 'pipe',
        env: { ...process.env, SDLC_PACKAGE_DIR: proj.dir },
      });
      exitCode = 0;
    } catch (err) {
      exitCode = err.status;
      output = (err.stderr?.toString() ?? '') + (err.stdout?.toString() ?? '');
    }
  });

  after(() => proj.cleanup());

  it('exits with code 1', () => {
    assert.strictEqual(exitCode, 1);
  });

  it('prints unknown platform in error message', () => {
    assert.ok(output.includes('vscode'), `Expected 'vscode' in output, got: ${output}`);
  });
});
