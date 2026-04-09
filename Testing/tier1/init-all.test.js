'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { assertFileExists, assertFileContains } = require('../helpers/file-assertions');
const { create, SDLC_ROOT } = require('../helpers/temp-project');

/**
 * Recursively collect all filenames (not full paths) from a directory.
 * @param {string} dir
 * @returns {string[]}
 */
function listFilesRecursive(dir) {
  if (!fs.existsSync(dir)) return [];
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      results.push(...listFilesRecursive(path.join(dir, entry.name)));
    } else {
      results.push(entry.name);
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

  it('creates docs/workflows/ directory', () => {
    const workflowsDir = path.join(proj.dir, 'docs', 'workflows');
    assert.ok(fs.existsSync(workflowsDir), `docs/workflows/ directory does not exist at "${workflowsDir}"`);
  });

  it('.gitignore contains platform entries', () => {
    assertFileExists(proj.dir, '.gitignore');
    assertFileContains(proj.dir, '.gitignore', '.claude/');
    assertFileContains(proj.dir, '.gitignore', '.codex/');
    assertFileContains(proj.dir, '.gitignore', 'AGENTS.md');
  });

  it('no file conflicts between platforms', () => {
    const claudeFiles = listFilesRecursive(path.join(proj.dir, '.claude'));
    const githubFiles = listFilesRecursive(path.join(proj.dir, '.github'));
    const codexFiles = listFilesRecursive(path.join(proj.dir, '.codex'));

    const allEntries = [
      ...claudeFiles.map(f => ({ file: f, platform: '.claude' })),
      ...githubFiles.map(f => ({ file: f, platform: '.github' })),
      ...codexFiles.map(f => ({ file: f, platform: '.codex' })),
    ];

    // Group by filename to detect cross-platform name collisions
    const byName = new Map();
    for (const { file, platform } of allEntries) {
      if (!byName.has(file)) byName.set(file, []);
      byName.get(file).push(platform);
    }

    const conflicts = [];
    for (const [name, platforms] of byName) {
      if (platforms.length > 1) {
        conflicts.push(`"${name}" appears in: ${platforms.join(', ')}`);
      }
    }

    assert.strictEqual(
      conflicts.length,
      0,
      `File name conflicts found across platform dirs:\n  ${conflicts.join('\n  ')}`,
    );
  });
});
