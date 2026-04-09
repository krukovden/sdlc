'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { create } = require('./temp-project.js');

describe('temp-project helper', () => {
  it('creates temp dir with .agents/ copied', async () => {
    let proj;
    try {
      proj = await create({ tier: 1 });
      const { dir } = proj;

      assert.ok(fs.existsSync(dir), 'temp dir should exist');
      assert.ok(
        fs.existsSync(path.join(dir, '.agents', 'agents', 'sdlc-lead.md')),
        '.agents/agents/sdlc-lead.md should exist'
      );
      assert.ok(
        fs.existsSync(path.join(dir, '.agents', 'skills', 'architect', 'SKILL.md')),
        '.agents/skills/architect/SKILL.md should exist'
      );
      assert.ok(
        fs.existsSync(path.join(dir, '.agents', 'guidelines', 'conventions.md')),
        '.agents/guidelines/conventions.md should exist'
      );
      assert.ok(
        fs.existsSync(path.join(dir, '.agents', 'workflows', 'feature.md')),
        '.agents/workflows/feature.md should exist'
      );
    } finally {
      if (proj) proj.cleanup();
    }

    // Verify cleanup removed dir
    assert.ok(!fs.existsSync(proj.dir), 'temp dir should be removed after cleanup');
  });

  it('copies setup.js and bin/ for running init', async () => {
    let proj;
    try {
      proj = await create({ tier: 1 });
      const { dir } = proj;

      assert.ok(
        fs.existsSync(path.join(dir, 'setup.js')),
        'setup.js should exist'
      );
      assert.ok(
        fs.existsSync(path.join(dir, 'bin', 'sdlc.js')),
        'bin/sdlc.js should exist'
      );
      assert.ok(
        fs.existsSync(path.join(dir, 'AGENTS.md')),
        'AGENTS.md should exist'
      );
    } finally {
      if (proj) proj.cleanup();
    }
  });

  it('runs init for specified tool', async () => {
    let proj;
    try {
      proj = await create({ tier: 1, tool: 'claude' });
      const { dir } = proj;

      assert.ok(
        fs.existsSync(path.join(dir, '.claude', 'CLAUDE.md')),
        '.claude/CLAUDE.md should exist after init claude'
      );
    } finally {
      if (proj) proj.cleanup();
    }
  });
});
