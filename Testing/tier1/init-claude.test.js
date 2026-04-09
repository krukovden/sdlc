'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { assertFileExists, assertFileContains } = require('../helpers/file-assertions');
const { create, SDLC_ROOT } = require('../helpers/temp-project');
const state = require('../helpers/expected-state');

describe('init claude', () => {
  let proj;

  before(async () => {
    proj = await create({ tier: 1, tool: 'claude' });
  });

  after(() => {
    proj.cleanup();
  });

  it('creates .claude/CLAUDE.md', () => {
    assertFileExists(proj.dir, '.claude/CLAUDE.md');
    assertFileContains(proj.dir, '.claude/CLAUDE.md', '## Source of Truth');
  });

  it('creates .claude/QUICKSTART.md', () => {
    assertFileExists(proj.dir, '.claude/QUICKSTART.md');
  });

  it('creates valid .claude/settings.json', () => {
    assertFileExists(proj.dir, '.claude/settings.json');
    const full = path.join(proj.dir, '.claude/settings.json');
    const parsed = JSON.parse(fs.readFileSync(full, 'utf8'));
    assert.ok('env' in parsed, 'settings.json missing key: env');
    assert.ok('hooks' in parsed, 'settings.json missing key: hooks');
    assert.ok('defaults' in parsed, 'settings.json missing key: defaults');
  });

  const agents = state.agentNames;

  for (const name of agents) {
    it(`creates agent file for ${name}`, () => {
      assertFileExists(proj.dir, `.claude/agents/${name}.md`);
    });

    it(`${name} agent file has frontmatter with name and description`, () => {
      assertFileContains(proj.dir, `.claude/agents/${name}.md`, `name: ${name}`);
      assertFileContains(proj.dir, `.claude/agents/${name}.md`, /description: ".+"/);
    });
  }

  it('creates skill files matching .agents/skills/', () => {
    const skillsDir = path.join(proj.dir, '.agents', 'skills');
    const skillNames = fs.readdirSync(skillsDir, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name);

    for (const name of skillNames) {
      assertFileExists(proj.dir, `.claude/skills/SKILL.${name}.md`);
    }
  });

  it('skill content matches source', () => {
    const skillsDir = path.join(proj.dir, '.agents', 'skills');
    const skillNames = fs.readdirSync(skillsDir, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name);

    for (const name of skillNames) {
      const sourcePath = path.join(skillsDir, name, 'SKILL.md');
      if (!fs.existsSync(sourcePath)) continue;
      const generatedPath = path.join(proj.dir, '.claude', 'skills', `SKILL.${name}.md`);
      const sourceContent = fs.readFileSync(sourcePath, 'utf8');
      const generatedContent = fs.readFileSync(generatedPath, 'utf8');
      assert.strictEqual(
        generatedContent,
        sourceContent,
        `Skill content mismatch for ${name}`,
      );
    }
  });

  const commands = state.commandNames;

  for (const cmd of commands) {
    it(`creates command file for ${cmd}`, () => {
      assertFileExists(proj.dir, `.claude/commands/${cmd}.md`);
    });
  }

  it('only expected subdirectories in .claude/', () => {
    const claudeDir = path.join(proj.dir, '.claude');
    const entries = fs.readdirSync(claudeDir, { withFileTypes: true });

    const dirs = entries
      .filter(e => e.isDirectory())
      .map(e => e.name)
      .sort();

    const files = entries
      .filter(e => e.isFile())
      .map(e => e.name)
      .sort();

    assert.deepStrictEqual(dirs, ['agents', 'commands', 'skills']);
    assert.deepStrictEqual(files, ['CLAUDE.md', 'QUICKSTART.md', 'settings.json']);
  });
});
