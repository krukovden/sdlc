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

  it('updates .claude/skills/architect/SKILL.md with the skill change', () => {
    assertFileContains(proj.dir, '.claude/skills/architect/SKILL.md', '<!-- test-update-marker -->');
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

  it('updates .claude/skills/architect/SKILL.md', () => {
    assertFileContains(proj.dir, '.claude/skills/architect/SKILL.md', '<!-- claude-only-marker -->');
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
    assertFileContains(proj.dir, '.claude/skills/architect/SKILL.md', '<!-- long-form-marker -->');
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
    assertFileContains(proj.dir, '.claude/skills/architect/SKILL.md', '<!-- all-marker -->');
  });
});

// ─── -u claude: reads skills from PROJECT, not PACKAGE ────────────────────
//
// Regression guard: when SDLC_PACKAGE_DIR !== PROJECT_DIR, update must read
// skill files from the project's .sdlc/ tree so local edits survive. Previous
// versions silently regenerated from the packaged defaults, reverting user
// customisations to skills like sdlc/SKILL.md and sdlc/references/*.md.

describe('-u claude: reads skill content from project, not package', () => {
  let proj;
  let pkgDir;

  before(async () => {
    proj = await create({ tool: 'claude' });

    // Build a separate "package" dir that hosts its own copy of bin/setup.js/.sdlc.
    // bin/sdlc.js derives SDLC_PACKAGE_DIR from its own __dirname (line ~141), so
    // running pkgDir/bin/sdlc.js — not proj.dir/bin/sdlc.js — is the only way to
    // make PACKAGE_DIR and PROJECT_DIR diverge in this test.
    pkgDir = path.join(path.dirname(proj.dir), `tier1-pkg-${Date.now()}`);

    function copyTree(src, dest) {
      fs.mkdirSync(dest, { recursive: true });
      for (const e of fs.readdirSync(src, { withFileTypes: true })) {
        const s = path.join(src, e.name);
        const d = path.join(dest, e.name);
        if (e.isDirectory()) copyTree(s, d);
        else fs.copyFileSync(s, d);
      }
    }
    copyTree(path.join(proj.dir, '.sdlc'), path.join(pkgDir, '.sdlc'));
    fs.copyFileSync(path.join(proj.dir, 'setup.js'), path.join(pkgDir, 'setup.js'));
    fs.copyFileSync(path.join(proj.dir, 'package.json'), path.join(pkgDir, 'package.json'));
    copyTree(path.join(proj.dir, 'bin'), path.join(pkgDir, 'bin'));

    // Diverge the marker: project's skill says "from-project", package's says "from-package".
    fs.writeFileSync(
      path.join(proj.dir, '.sdlc', 'skills', 'architect', 'SKILL.md'),
      '---\nname: architect\ndescription: test\n---\nfrom-project\n',
    );
    fs.writeFileSync(
      path.join(pkgDir, '.sdlc', 'skills', 'architect', 'SKILL.md'),
      '---\nname: architect\ndescription: test\n---\nfrom-package\n',
    );

    execFileSync(process.execPath, [path.join(pkgDir, 'bin', 'sdlc.js'), '-u', 'claude'], {
      cwd: proj.dir,
      stdio: 'pipe',
    });
  });

  after(() => {
    proj.cleanup();
    if (!process.env.SDLC_TEST_KEEP) {
      fs.rmSync(pkgDir, { recursive: true, force: true });
    }
  });

  it('regenerates .claude/skills/architect/SKILL.md from the project tree', () => {
    assertFileContains(proj.dir, '.claude/skills/architect/SKILL.md', 'from-project');
  });

  it('does not fall back to the package copy', () => {
    const content = fs.readFileSync(
      path.join(proj.dir, '.claude/skills/architect/SKILL.md'),
      'utf8',
    );
    assert.ok(!content.includes('from-package'),
      `Expected project content, got package content: ${content}`);
  });
});

// ─── -u claude: prunes legacy flat SKILL.<name>.md files ──────────────────
//
// Regression guard for layout migration: pre-migration installs stored skills
// as `.claude/skills/SKILL.<name>.md`. After migration to `.claude/skills/<name>/SKILL.md`,
// `-u claude` must delete the orphaned flat files so they are not left
// unmanaged outside the manifest (which would survive `uninstall`).

describe('-u claude: prunes legacy flat SKILL.<name>.md files', () => {
  let proj;
  let orphanPath;

  before(async () => {
    proj = await create({ tool: 'claude' });

    // Simulate an upgrade from the previous flat layout: drop a leftover
    // `SKILL.legacy-skill.md` next to the new directory layout. The update
    // pass should sweep it.
    orphanPath = path.join(proj.dir, '.claude', 'skills', 'SKILL.legacy-skill.md');
    fs.writeFileSync(orphanPath, '---\nname: legacy-skill\n---\nold-flat-layout\n');

    execFileSync(process.execPath, ['bin/sdlc.js', '-u', 'claude'], {
      cwd: proj.dir,
      stdio: 'pipe',
      env: { ...process.env, SDLC_PACKAGE_DIR: proj.dir },
    });
  });

  after(() => proj.cleanup());

  it('deletes the legacy flat-layout skill file', () => {
    assert.ok(!fs.existsSync(orphanPath),
      `Expected legacy ${orphanPath} to be pruned, but it still exists`);
  });

  it('still produces the directory-layout SKILL.md for real skills', () => {
    assert.ok(
      fs.existsSync(path.join(proj.dir, '.claude/skills/architect/SKILL.md')),
      'Expected .claude/skills/architect/SKILL.md to exist after update',
    );
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
