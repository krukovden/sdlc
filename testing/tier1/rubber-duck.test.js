'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { SDLC_ROOT, create } = require('../helpers/temp-project');
const { assertFileExists, assertFileContains } = require('../helpers/file-assertions');

function readSource(relPath) {
  return fs.readFileSync(path.join(SDLC_ROOT, relPath), 'utf8');
}

// ---------------------------------------------------------------------------
// Source contract tests — read directly from .sdlc/
// ---------------------------------------------------------------------------

describe('rubber-duck source contracts', () => {
  describe('sdlc-rubber-duck.md', () => {
    it('file exists in .sdlc/agents/', () => {
      const p = path.join(SDLC_ROOT, '.sdlc/agents/sdlc-rubber-duck.md');
      assert.ok(fs.existsSync(p), 'sdlc-rubber-duck.md not found in .sdlc/agents/');
    });

    it('has Role section', () => {
      assert.ok(readSource('.sdlc/agents/sdlc-rubber-duck.md').includes('## Role'));
    });

    it('has Boundaries section', () => {
      assert.ok(readSource('.sdlc/agents/sdlc-rubber-duck.md').includes('## Boundaries'));
    });

    it('has Verdict Format section', () => {
      assert.ok(readSource('.sdlc/agents/sdlc-rubber-duck.md').includes('## Verdict Format'));
    });

    it('has Autonomous Pipeline Mode section', () => {
      assert.ok(readSource('.sdlc/agents/sdlc-rubber-duck.md').includes('## Autonomous Pipeline Mode'));
    });

    it('declares cross-model intent', () => {
      const content = readSource('.sdlc/agents/sdlc-rubber-duck.md');
      assert.ok(
        content.includes('different model') || content.includes('opposite model'),
        'Missing cross-model language',
      );
    });

    it('declares terminal node', () => {
      assert.ok(readSource('.sdlc/agents/sdlc-rubber-duck.md').includes('terminal node'));
    });

    it('declares independent retry budget', () => {
      assert.ok(readSource('.sdlc/agents/sdlc-rubber-duck.md').includes('independent'));
    });

    it('enforces read-only boundary', () => {
      assert.ok(readSource('.sdlc/agents/sdlc-rubber-duck.md').includes('Do NOT modify code'));
    });

    it('supports PASS / NEEDS CHANGES / FAIL verdicts', () => {
      const content = readSource('.sdlc/agents/sdlc-rubber-duck.md');
      assert.ok(content.includes('PASS'));
      assert.ok(content.includes('NEEDS CHANGES'));
      assert.ok(content.includes('FAIL'));
    });
  });

  describe('sdlc-lead.md', () => {
    it('includes Copilot Fleet as dispatch mode option', () => {
      assert.ok(readSource('.sdlc/agents/sdlc-lead.md').includes('Copilot Fleet'));
    });

    it('has Rubber Duck Model Selection section', () => {
      assert.ok(readSource('.sdlc/agents/sdlc-lead.md').includes('Rubber Duck Model Selection'));
    });

    it('includes Rubber Duck in pipeline sequence tables', () => {
      assert.ok(readSource('.sdlc/agents/sdlc-lead.md').includes('Rubber Duck'));
    });

    it('defines opposite-model selection logic', () => {
      const content = readSource('.sdlc/agents/sdlc-lead.md');
      assert.ok(content.includes('claude-opus-4-7'), 'Missing Opus model reference');
      assert.ok(content.includes('GPT'), 'Missing GPT model reference');
    });
  });

  describe('sdlc-security.md', () => {
    it('checks rubber_duck.enabled before deciding terminal status', () => {
      assert.ok(readSource('.sdlc/agents/sdlc-security.md').includes('rubber_duck.enabled'));
    });

    it('spawns Rubber Duck agent when enabled', () => {
      const content = readSource('.sdlc/agents/sdlc-security.md');
      assert.ok(content.includes('Rubber Duck'), 'Security missing Rubber Duck spawn reference');
    });
  });

  describe('sdlc-plan SKILL.md', () => {
    it('has rubber_duck field in task format', () => {
      assert.ok(readSource('.sdlc/skills/sdlc-plan/SKILL.md').includes('rubber_duck'));
    });

    it('has Rubber Duck Evaluation section', () => {
      assert.ok(readSource('.sdlc/skills/sdlc-plan/SKILL.md').includes('Rubber Duck Evaluation'));
    });

    it('includes Rubber Duck Configuration in stop-gate', () => {
      assert.ok(readSource('.sdlc/skills/sdlc-plan/SKILL.md').includes('Rubber Duck Configuration'));
    });

    it('has enablement heuristics for auth/PII tasks', () => {
      const content = readSource('.sdlc/skills/sdlc-plan/SKILL.md');
      assert.ok(content.includes('authentication') || content.includes('auth'), 'Missing auth heuristic');
      assert.ok(content.includes('PII'), 'Missing PII heuristic');
    });
  });

  describe('sdlc-implement SKILL.md', () => {
    it('has three dispatch mode options', () => {
      const content = readSource('.sdlc/skills/sdlc-implement/SKILL.md');
      assert.ok(content.includes('Agent Teams'), 'Missing Agent Teams mode');
      assert.ok(content.includes('Copilot Fleet'), 'Missing Copilot Fleet mode');
      assert.ok(content.includes('sequential'), 'Missing sequential fallback');
    });

    it('includes Rubber Duck in pipeline sequences', () => {
      assert.ok(readSource('.sdlc/skills/sdlc-implement/SKILL.md').includes('Rubber Duck'));
    });

    it('has Rubber Duck field in implementation log template', () => {
      const content = readSource('.sdlc/skills/sdlc-implement/SKILL.md');
      assert.ok(content.includes('Rubber Duck'), 'Implementation log missing Rubber Duck field');
    });
  });
});

// ---------------------------------------------------------------------------
// Generated file tests — verify init produces Rubber Duck agent files
// ---------------------------------------------------------------------------

describe('rubber-duck generated files', () => {
  let proj;

  before(async () => {
    proj = await create({ tier: 1, tool: 'all' });
  });

  after(() => {
    proj.cleanup();
  });

  it('creates .claude/agents/sdlc-rubber-duck.md', () => {
    assertFileExists(proj.dir, '.claude/agents/sdlc-rubber-duck.md');
  });

  it('claude agent has name frontmatter', () => {
    assertFileContains(proj.dir, '.claude/agents/sdlc-rubber-duck.md', 'name: sdlc-rubber-duck');
  });

  it('claude agent has description frontmatter', () => {
    assertFileContains(proj.dir, '.claude/agents/sdlc-rubber-duck.md', /description: ".+"/);
  });

  it('creates .github/agents/sdlc-rubber-duck.agent.md', () => {
    assertFileExists(proj.dir, '.github/agents/sdlc-rubber-duck.agent.md');
  });

  it('creates .codex/agents/sdlc-rubber-duck.toml', () => {
    assertFileExists(proj.dir, '.codex/agents/sdlc-rubber-duck.toml');
  });

  it('claude agent references role instructions file', () => {
    assertFileContains(
      proj.dir,
      '.claude/agents/sdlc-rubber-duck.md',
      '.sdlc/agents/sdlc-rubber-duck.md',
    );
  });
});
