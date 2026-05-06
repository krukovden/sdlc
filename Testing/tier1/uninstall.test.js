'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const { create } = require('../helpers/temp-project');
const { assertFileExists, assertFileNotExists, assertFileNotContains } = require('../helpers/file-assertions');

describe('manifest: created after init', () => {
  let proj;
  let manifest;

  before(async () => {
    proj = await create({ tool: 'claude' });
    const full = path.join(proj.dir, '.sdlc/manifest.json');
    manifest = JSON.parse(fs.readFileSync(full, 'utf8'));
  });

  after(() => proj.cleanup());

  it('creates .sdlc/manifest.json', () => {
    assertFileExists(proj.dir, '.sdlc/manifest.json');
  });

  it('manifest has version, createdAt, updatedAt, platforms, files, gitignoreBlock', () => {
    assert.ok(typeof manifest.version === 'string', 'version must be string');
    assert.ok(typeof manifest.createdAt === 'string', 'createdAt must be string');
    assert.ok(typeof manifest.updatedAt === 'string', 'updatedAt must be string');
    assert.ok(Array.isArray(manifest.platforms), 'platforms must be array');
    assert.ok(Array.isArray(manifest.files), 'files must be array');
    assert.strictEqual(manifest.gitignoreBlock, true);
  });

  it('manifest.platforms contains "claude"', () => {
    assert.ok(manifest.platforms.includes('claude'), `expected claude, got ${manifest.platforms}`);
  });

  it('manifest.files includes .claude/CLAUDE.md', () => {
    assert.ok(manifest.files.includes('.claude/CLAUDE.md'), 'expected .claude/CLAUDE.md');
  });

  it('manifest.files includes AGENTS.md', () => {
    assert.ok(manifest.files.includes('AGENTS.md'), 'expected AGENTS.md');
  });

  it('manifest.files includes a .sdlc/ skill file', () => {
    const hasAgentsFile = manifest.files.some(f => f.startsWith('.sdlc/skills/'));
    assert.ok(hasAgentsFile, 'expected at least one .sdlc/skills/ file');
  });

  it('manifest.files does NOT include the manifest itself', () => {
    assert.ok(!manifest.files.includes('.sdlc/manifest.json'), 'manifest must not list itself');
  });
});

describe('manifest: -u claude preserves copilot file entries', () => {
  let proj;
  let initialManifest;
  let manifestAfter;

  before(async () => {
    // Init both platforms
    proj = await create({ tool: 'all' });

    // Verify initial manifest has both
    initialManifest = JSON.parse(
      fs.readFileSync(path.join(proj.dir, '.sdlc/manifest.json'), 'utf8'),
    );
    assert.ok(initialManifest.files.some(f => f.startsWith('.github/')), 'precondition: github in initial manifest');

    // Update only claude
    execFileSync(process.execPath, ['bin/sdlc.js', '-u', 'claude'], {
      cwd: proj.dir,
      stdio: 'pipe',
      env: { ...process.env, SDLC_PACKAGE_DIR: proj.dir },
    });

    manifestAfter = JSON.parse(
      fs.readFileSync(path.join(proj.dir, '.sdlc/manifest.json'), 'utf8'),
    );
  });

  after(() => proj.cleanup());

  it('preserves .github/ entries in manifest after -u claude', () => {
    const githubFiles = manifestAfter.files.filter(f => f.startsWith('.github/'));
    assert.ok(githubFiles.length > 0, `expected .github/ files preserved, got ${manifestAfter.files}`);
  });

  it('keeps .claude/ entries in manifest after -u claude', () => {
    const claudeFiles = manifestAfter.files.filter(f => f.startsWith('.claude/'));
    assert.ok(claudeFiles.length > 0, 'expected .claude/ files in manifest');
  });

  it('preserves createdAt across update (exact match)', () => {
    assert.strictEqual(
      manifestAfter.createdAt,
      initialManifest.createdAt,
      'createdAt must not change across updates',
    );
    assert.ok(manifestAfter.updatedAt >= manifestAfter.createdAt, 'updatedAt must be >= createdAt');
  });
});

describe('uninstall: -x removes all sdlc artifacts', () => {
  let proj;

  before(async () => {
    proj = await create({ tool: 'all' });

    // Add a user file that lives inside .github/ (alongside generated copilot files)
    fs.writeFileSync(
      path.join(proj.dir, '.github', 'CODEOWNERS'),
      '* @user\n',
      'utf8',
    );

    // Add a user file at project root
    fs.writeFileSync(
      path.join(proj.dir, 'user-readme.md'),
      'user content\n',
      'utf8',
    );

    execFileSync(process.execPath, ['bin/sdlc.js', '-x'], {
      cwd: proj.dir,
      stdio: 'pipe',
      env: { ...process.env, SDLC_PACKAGE_DIR: proj.dir },
    });
  });

  after(() => proj.cleanup());

  it('removes .claude/CLAUDE.md', () => {
    assertFileNotExists(proj.dir, '.claude/CLAUDE.md');
  });

  it('removes .claude/ directory entirely (no leftover files)', () => {
    assert.ok(
      !fs.existsSync(path.join(proj.dir, '.claude')),
      '.claude/ should be removed',
    );
  });

  it('removes .codex/ directory entirely', () => {
    assert.ok(
      !fs.existsSync(path.join(proj.dir, '.codex')),
      '.codex/ should be removed',
    );
  });

  it('removes .sdlc/ directory entirely', () => {
    assert.ok(
      !fs.existsSync(path.join(proj.dir, '.sdlc')),
      '.sdlc/ should be removed',
    );
  });

  it('removes AGENTS.md from project root', () => {
    assertFileNotExists(proj.dir, 'AGENTS.md');
  });

  it('strips generated block from .gitignore', () => {
    assertFileNotContains(proj.dir, '.gitignore', '# Generated by npx sdlc init');
  });

  it('preserves user file .github/CODEOWNERS', () => {
    assertFileExists(proj.dir, '.github/CODEOWNERS');
  });

  it('does not delete .github/ directory because user file remains', () => {
    assert.ok(
      fs.existsSync(path.join(proj.dir, '.github')),
      '.github/ should remain because user file is in it',
    );
  });

  it('preserves user-readme.md at project root', () => {
    assertFileExists(proj.dir, 'user-readme.md');
  });
});

describe('uninstall: --uninstall long form works', () => {
  let proj;

  before(async () => {
    proj = await create({ tool: 'claude' });
    execFileSync(process.execPath, ['bin/sdlc.js', '--uninstall'], {
      cwd: proj.dir,
      stdio: 'pipe',
      env: { ...process.env, SDLC_PACKAGE_DIR: proj.dir },
    });
  });

  after(() => proj.cleanup());

  it('removes .sdlc/ via long flag', () => {
    assert.ok(!fs.existsSync(path.join(proj.dir, '.sdlc')));
  });
});

describe('uninstall: word command works', () => {
  let proj;

  before(async () => {
    proj = await create({ tool: 'claude' });
    execFileSync(process.execPath, ['bin/sdlc.js', 'uninstall'], {
      cwd: proj.dir,
      stdio: 'pipe',
      env: { ...process.env, SDLC_PACKAGE_DIR: proj.dir },
    });
  });

  after(() => proj.cleanup());

  it('removes .sdlc/ via word command', () => {
    assert.ok(!fs.existsSync(path.join(proj.dir, '.sdlc')));
  });
});

describe('uninstall: error when no manifest', () => {
  let proj;
  let exitCode;
  let output;

  before(async () => {
    proj = await create({}); // base project with .sdlc/ but no manifest
    try {
      execFileSync(process.execPath, ['bin/sdlc.js', '-x'], {
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

  it('prints "No sdlc installation found" message', () => {
    assert.ok(
      output.includes('No sdlc installation found'),
      `Expected helpful error, got: ${output}`,
    );
  });
});
