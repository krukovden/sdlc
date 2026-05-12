'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { assertFileExists, assertFileContains } = require('../helpers/file-assertions');
const { create, SDLC_ROOT } = require('../helpers/temp-project');

/**
 * Recursively collect every file under `dir`, returned as POSIX-style paths
 * relative to the original root. The relative form (e.g. `architect/SKILL.md`,
 * not just `SKILL.md`) is what lets the no-cross-platform-conflict test
 * distinguish files that live in different subtrees of the same platform.
 * @param {string} dir      Directory to walk.
 * @param {string} [baseDir=dir]  Root the returned paths are relative to.
 *   Pinned at the first call via the default so recursive calls measure
 *   against the original root, not the current sub-directory.
 * @returns {string[]} Relative POSIX paths, one per file found.
 */
function listFilesRecursive(dir, baseDir = dir) {
  if (!fs.existsSync(dir)) return [];
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...listFilesRecursive(full, baseDir));
    } else {
      results.push(path.relative(baseDir, full).split(path.sep).join('/'));
    }
  }
  return results;
}

describe('init all', () => {
  let proj;

  before(async () => {
    proj = await create({ tier: 1, tool: 'all' });
  });

  after(() => {
    proj.cleanup();
  });

  it('creates .claude/ directory', () => {
    assertFileExists(proj.dir, '.claude/CLAUDE.md');
  });

  it('creates .github/ directory', () => {
    assertFileExists(proj.dir, '.github/copilot-instructions.md');
  });

  it('creates .codex/ directory', () => {
    assertFileExists(proj.dir, '.codex/config.toml');
  });

  it('creates AGENTS.md at project root', () => {
    assertFileExists(proj.dir, 'AGENTS.md');
    assertFileContains(proj.dir, 'AGENTS.md', 'Source of Truth');
  });

  it('creates sdlc-doc/workflows/ directory', () => {
    const workflowsDir = path.join(proj.dir, 'sdlc-doc', 'workflows');
    assert.ok(fs.existsSync(workflowsDir), `sdlc-doc/workflows/ directory does not exist at "${workflowsDir}"`);
  });

  it('.gitignore contains platform entries', () => {
    assertFileExists(proj.dir, '.gitignore');
    assertFileContains(proj.dir, '.gitignore', '.claude/');
    assertFileContains(proj.dir, '.gitignore', '.codex/');
    assertFileContains(proj.dir, '.gitignore', 'AGENTS.md');
  });

  it('no file conflicts across platforms (same relative path used by multiple platforms)', () => {
    // We track files by their path *relative to the platform dir*, not basename.
    // Many platform-internal duplicates are normal — every skill in the Agent
    // Skills layout has its own SKILL.md (architect/SKILL.md, sdlc/SKILL.md, …).
    // What we want to catch is the same logical artifact ending up under two
    // different platform roots (e.g. copilot-instructions.md getting generated
    // into both .claude and .github), which would mean setup.js wrote to the
    // wrong tree.
    const claudeFiles = listFilesRecursive(path.join(proj.dir, '.claude'));
    const githubFiles = listFilesRecursive(path.join(proj.dir, '.github'));
    const codexFiles = listFilesRecursive(path.join(proj.dir, '.codex'));

    const byPath = new Map();
    const record = (files, platform) => {
      for (const f of files) {
        if (!byPath.has(f)) byPath.set(f, new Set());
        byPath.get(f).add(platform);
      }
    };
    record(claudeFiles, '.claude');
    record(githubFiles, '.github');
    record(codexFiles, '.codex');

    const conflicts = [];
    for (const [relPath, platforms] of byPath) {
      if (platforms.size > 1) {
        conflicts.push(`"${relPath}" appears in: ${[...platforms].join(', ')}`);
      }
    }

    assert.strictEqual(
      conflicts.length,
      0,
      `Same relative path generated into multiple platform dirs:\n  ${conflicts.join('\n  ')}`,
    );
  });
});
