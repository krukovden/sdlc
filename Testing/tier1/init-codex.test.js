'use strict';

const { describe, it, before, after } = require('node:test');

const {
  assertFileExists,
  assertFileContains,
  assertFileNotContains,
  assertValidTOML,
} = require('../helpers/file-assertions');
const { create } = require('../helpers/temp-project');

describe('init codex', () => {
  let proj;

  before(async () => {
    proj = await create({ tier: 1, tool: 'codex' });
  });

  after(() => {
    proj.cleanup();
  });

  it('creates .codex/config.toml', () => {
    assertFileExists(proj.dir, '.codex/config.toml');
    assertValidTOML(proj.dir, '.codex/config.toml');
    assertFileContains(proj.dir, '.codex/config.toml', '[agents]');
    assertFileContains(proj.dir, '.codex/config.toml', '[features]');
  });

  const agents = ['sdlc-lead', 'sdlc-coder', 'sdlc-tester', 'sdlc-reviewer', 'sdlc-security'];

  for (const name of agents) {
    it(`creates agent TOML for ${name}`, () => {
      assertFileExists(proj.dir, `.codex/agents/${name}.toml`);
      assertValidTOML(proj.dir, `.codex/agents/${name}.toml`);
    });

    it(`${name} TOML has required fields`, () => {
      assertFileContains(proj.dir, `.codex/agents/${name}.toml`, `name = "${name}"`);
      assertFileContains(proj.dir, `.codex/agents/${name}.toml`, /description = ".+"/);
      assertFileContains(proj.dir, `.codex/agents/${name}.toml`, 'sandbox_mode =');
      assertFileContains(proj.dir, `.codex/agents/${name}.toml`, 'developer_instructions =');
    });
  }

  it('Lead TOML has high reasoning effort', () => {
    assertFileContains(proj.dir, '.codex/agents/sdlc-lead.toml', 'model_reasoning_effort = "high"');
  });

  const nonLeadAgents = ['sdlc-coder', 'sdlc-tester', 'sdlc-reviewer', 'sdlc-security'];

  for (const name of nonLeadAgents) {
    it(`${name} TOML does not have reasoning override`, () => {
      assertFileNotContains(proj.dir, `.codex/agents/${name}.toml`, 'model_reasoning_effort');
    });
  }
});
