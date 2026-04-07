'use strict';

const { describe, it, before, after } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

const { create } = require('../helpers/temp-project.js');
const { assertFileExists, assertFileContains } = require('../helpers/file-assertions.js');

const AGENTS = ['sdlc-lead', 'sdlc-coder', 'sdlc-tester', 'sdlc-reviewer', 'sdlc-security'];
const COMMANDS = ['sdlc', 'sdlc-clarify', 'sdlc-research', 'sdlc-design', 'sdlc-plan', 'sdlc-implement', 'sdlc-resume'];

describe('init copilot', () => {
  let proj;

  before(async () => {
    proj = await create({ tier: 1 });

    // Pre-create .github/workflows/publish.yml to test it isn't overwritten
    const workflowsDir = path.join(proj.dir, '.github', 'workflows');
    fs.mkdirSync(workflowsDir, { recursive: true });
    fs.writeFileSync(
      path.join(workflowsDir, 'publish.yml'),
      'name: Publish\non: push\n',
      'utf8'
    );

    execSync('node bin/sdlc.js init copilot', {
      cwd: proj.dir,
      env: { ...process.env, SDLC_PACKAGE_DIR: proj.dir, SDLC_COMMAND: 'init' },
      stdio: 'pipe',
    });
  });

  after(() => {
    proj.cleanup();
  });

  it('creates .github/copilot-instructions.md', () => {
    assertFileExists(proj.dir, '.github/copilot-instructions.md');
    assertFileContains(proj.dir, '.github/copilot-instructions.md', '## Source of Truth');
  });

  for (const name of AGENTS) {
    it(`creates agent file for ${name}`, () => {
      assertFileExists(proj.dir, `.github/agents/${name}.agent.md`);
    });

    it(`${name} agent file has frontmatter with name, description, tools`, () => {
      assertFileContains(proj.dir, `.github/agents/${name}.agent.md`, `name: ${name}`);
      assertFileContains(proj.dir, `.github/agents/${name}.agent.md`, /description: ".+"/);
      assertFileContains(proj.dir, `.github/agents/${name}.agent.md`, 'tools:');
    });
  }

  it('Lead agent references @sdlc-coder, @sdlc-tester, etc.', () => {
    assertFileContains(proj.dir, '.github/agents/sdlc-lead.agent.md', '@sdlc-coder');
    assertFileContains(proj.dir, '.github/agents/sdlc-lead.agent.md', '@sdlc-tester');
    assertFileContains(proj.dir, '.github/agents/sdlc-lead.agent.md', '@sdlc-reviewer');
    assertFileContains(proj.dir, '.github/agents/sdlc-lead.agent.md', '@sdlc-security');
  });

  for (const cmd of COMMANDS) {
    it(`creates prompt file for ${cmd}`, () => {
      assertFileExists(proj.dir, `.github/prompts/${cmd}.prompt.md`);
    });
  }

  it('preserves existing .github/workflows/publish.yml', () => {
    assertFileExists(proj.dir, '.github/workflows/publish.yml');
    assertFileContains(proj.dir, '.github/workflows/publish.yml', 'name: Publish');
  });
});
