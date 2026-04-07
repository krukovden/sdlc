'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { create } = require('../helpers/temp-project');

// Expected guideline assignments per AGENT_META in setup.js
const AGENT_GUIDELINES = {
  'sdlc-lead':     { has: ['conventions.md', 'principles.md'],     not: ['testing.md', 'error-handling.md'] },
  'sdlc-coder':    { has: ['conventions.md', 'principles.md'],     not: ['testing.md', 'error-handling.md'] },
  'sdlc-tester':   { has: ['testing.md', 'conventions.md'],        not: ['principles.md', 'error-handling.md'] },
  'sdlc-reviewer': { has: ['principles.md', 'conventions.md'],     not: ['testing.md', 'error-handling.md'] },
  'sdlc-security': { has: ['error-handling.md', 'conventions.md'], not: ['testing.md', 'principles.md'] },
};

const ALL_GUIDELINES = ['conventions.md', 'principles.md', 'testing.md', 'error-handling.md'];

describe('agent isolation', () => {
  let proj;

  before(async () => {
    proj = await create({ tier: 1, tool: 'all' });
  });

  after(() => {
    proj.cleanup();
  });

  // ---------------------------------------------------------------------------
  // Claude: .claude/agents/{name}.md
  // ---------------------------------------------------------------------------
  describe('claude', () => {
    for (const [agentName, { has, not }] of Object.entries(AGENT_GUIDELINES)) {
      const agentFile = path.join('.claude', 'agents', `${agentName}.md`);

      for (const guideline of has) {
        it(`${agentName} references ${guideline}`, () => {
          const filePath = path.join(proj.dir, agentFile);
          const content = fs.readFileSync(filePath, 'utf8');
          assert.ok(
            content.includes(guideline),
            `Expected "${agentFile}" to reference "${guideline}" but it did not.\nContent:\n${content}`,
          );
        });
      }

      for (const guideline of not) {
        it(`${agentName} does not reference ${guideline}`, () => {
          const filePath = path.join(proj.dir, agentFile);
          const content = fs.readFileSync(filePath, 'utf8');
          assert.ok(
            !content.includes(guideline),
            `Expected "${agentFile}" NOT to reference "${guideline}" but it did.\nContent:\n${content}`,
          );
        });
      }
    }

    it('no agent references all 4 guidelines', () => {
      for (const agentName of Object.keys(AGENT_GUIDELINES)) {
        const filePath = path.join(proj.dir, '.claude', 'agents', `${agentName}.md`);
        const content = fs.readFileSync(filePath, 'utf8');
        const count = ALL_GUIDELINES.filter(g => content.includes(g)).length;
        assert.ok(
          count < 4,
          `Claude agent "${agentName}" references all 4 guidelines (expected < 4).`,
        );
      }
    });
  });

  // ---------------------------------------------------------------------------
  // Copilot: .github/agents/{name}.agent.md
  // ---------------------------------------------------------------------------
  describe('copilot', () => {
    for (const [agentName, { has, not }] of Object.entries(AGENT_GUIDELINES)) {
      const agentFile = path.join('.github', 'agents', `${agentName}.agent.md`);

      for (const guideline of has) {
        it(`${agentName} references ${guideline}`, () => {
          const filePath = path.join(proj.dir, agentFile);
          const content = fs.readFileSync(filePath, 'utf8');
          assert.ok(
            content.includes(guideline),
            `Expected "${agentFile}" to reference "${guideline}" but it did not.\nContent:\n${content}`,
          );
        });
      }

      for (const guideline of not) {
        it(`${agentName} does not reference ${guideline}`, () => {
          const filePath = path.join(proj.dir, agentFile);
          const content = fs.readFileSync(filePath, 'utf8');
          assert.ok(
            !content.includes(guideline),
            `Expected "${agentFile}" NOT to reference "${guideline}" but it did.\nContent:\n${content}`,
          );
        });
      }
    }

    it('no agent references all 4 guidelines', () => {
      for (const agentName of Object.keys(AGENT_GUIDELINES)) {
        const filePath = path.join(proj.dir, '.github', 'agents', `${agentName}.agent.md`);
        const content = fs.readFileSync(filePath, 'utf8');
        const count = ALL_GUIDELINES.filter(g => content.includes(g)).length;
        assert.ok(
          count < 4,
          `Copilot agent "${agentName}" references all 4 guidelines (expected < 4).`,
        );
      }
    });
  });

  // ---------------------------------------------------------------------------
  // Codex: .codex/agents/{name}.toml
  // ---------------------------------------------------------------------------
  describe('codex', () => {
    for (const [agentName, { has, not }] of Object.entries(AGENT_GUIDELINES)) {
      const agentFile = path.join('.codex', 'agents', `${agentName}.toml`);

      for (const guideline of has) {
        it(`${agentName} references ${guideline}`, () => {
          const filePath = path.join(proj.dir, agentFile);
          const content = fs.readFileSync(filePath, 'utf8');
          assert.ok(
            content.includes(guideline),
            `Expected "${agentFile}" to reference "${guideline}" but it did not.\nContent:\n${content}`,
          );
        });
      }

      for (const guideline of not) {
        it(`${agentName} does not reference ${guideline}`, () => {
          const filePath = path.join(proj.dir, agentFile);
          const content = fs.readFileSync(filePath, 'utf8');
          assert.ok(
            !content.includes(guideline),
            `Expected "${agentFile}" NOT to reference "${guideline}" but it did.\nContent:\n${content}`,
          );
        });
      }
    }

    it('no agent references all 4 guidelines', () => {
      for (const agentName of Object.keys(AGENT_GUIDELINES)) {
        const filePath = path.join(proj.dir, '.codex', 'agents', `${agentName}.toml`);
        const content = fs.readFileSync(filePath, 'utf8');
        const count = ALL_GUIDELINES.filter(g => content.includes(g)).length;
        assert.ok(
          count < 4,
          `Codex agent "${agentName}" references all 4 guidelines (expected < 4).`,
        );
      }
    });
  });
});
