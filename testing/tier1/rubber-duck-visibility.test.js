'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const { SDLC_ROOT } = require('../helpers/temp-project');

function readSource(relPath) {
  return fs.readFileSync(path.join(SDLC_ROOT, relPath), 'utf8');
}

// One dashboard, one source of truth. `.agents/assets/` used to hold a second copy —
// a stale snapshot left behind by the `.agents/` → `.sdlc/` rename that nothing read
// (setup.js and the test harness both source `.sdlc/`) and that silently drifted out of
// date. It has been deleted; keeping a duplicate in sync was work with no payer.
const DASHBOARDS = ['.sdlc/assets/server/dashboard.html'];
const SKILL = '.sdlc/skills/sdlc/SKILL.md';
const IMPLEMENT = '.sdlc/skills/sdlc/references/implement.md';

// ---------------------------------------------------------------------------
// Rubber Duck runs in the pipeline and can bounce a task, so it must be visible.
// Before this, the agent ran, rejected work, and showed nothing on the kanban card —
// a task would sit active with no rendered cause.
// ---------------------------------------------------------------------------

describe('rubber duck visibility', () => {
  it('is in the manifest agents schema', () => {
    assert.match(readSource(SKILL), /"rubber_duck":\s*\{\s*"status"/);
  });

  it('the manifest key is documented so the Lead writes it exactly', () => {
    assert.match(readSource(IMPLEMENT), /`rubber_duck`/);
  });

  it('appears in the kanban legend', () => {
    assert.match(readSource(SKILL), /D=Rubber Duck/);
  });

  for (const dashboard of DASHBOARDS) {
    describe(dashboard, () => {
      it('declares the role in every lookup table', () => {
        const content = readSource(dashboard);
        for (const table of ['ROLES', 'ROLE_LETTER', 'ROLE_COLOR', 'ROLE_CLASS', 'ROLE_TITLE']) {
          const line = content.split('\n').find(l => l.includes(`const ${table}`));
          assert.ok(line, `${table} not found`);
          assert.match(line, /rubber_duck/, `${table} is missing rubber_duck`);
        }
      });

      it('orders the duck between security and lead, matching dispatch order', () => {
        const line = readSource(dashboard).split('\n').find(l => l.includes('const ROLES'));
        const roles = [...line.matchAll(/'([a-z_]+)'/g)].map(m => m[1]);
        assert.deepStrictEqual(roles, ['coder', 'tester', 'reviewer', 'security', 'rubber_duck', 'lead']);
      });

      it('renders a human-readable title, not the raw snake_case key', () => {
        const content = readSource(dashboard);
        assert.match(content, /rubber_duck:'Rubber Duck'/);
        assert.ok(
          !/role\.charAt\(0\)\.toUpperCase\(\)/.test(content),
          'capitalising the key yields "Rubber_duck"',
        );
      });

      it('gives the duck a colour distinct from every other role', () => {
        const line = readSource(dashboard).split('\n').find(l => l.includes('const ROLE_COLOR'));
        const colours = [...line.matchAll(/#[0-9a-f]{6}/gi)].map(m => m[0].toLowerCase());
        assert.strictEqual(new Set(colours).size, colours.length, 'two roles share a colour');
      });

      it('joins the pipeline with separators instead of indexing into ROLES', () => {
        // Deriving the arrow from the index leaves a trailing separator whenever the last
        // roles are absent — an optional Security, a disabled duck, an older manifest.
        const content = readSource(dashboard);
        assert.match(content, /\.join\('<span class="pipe-arrow">/);
        assert.ok(
          !/i < ROLES\.length - 1/.test(content),
          'index-derived arrows leave a trailing separator',
        );
      });

      it('draws all six canonical slots, rendering a missing role as a neutral dot', () => {
        // The card must draw the six canonical slots unconditionally so the Lead dot lands in
        // the same position on every card. A role the manifest omits (an optional Security, a
        // disabled Rubber Duck) renders a neutral dot in its slot, not nothing — the older
        // "return '' for a missing role" behaviour collapsed the row and misaligned the board.
        const content = readSource(dashboard);
        assert.ok(
          !/if \(!agentData\) return '';/.test(content),
          'dropping a missing role shifts every later dot and misaligns the cards',
        );
        assert.ok(
          !/\.filter\(role =>\s*task\.agents/.test(content),
          'the pipeline must map the canonical ROLES, not filter to present keys',
        );
        assert.match(content, /agentData \|\| \{status: 'skipped'/, 'a missing role falls back to a neutral dot');
      });

      it('clamps a closed task so a finished card never shows a spinning agent', () => {
        // A done/failed/skipped task cannot legitimately have a working agent; the display
        // clamps active -> passed and pending -> skipped regardless of an inconsistent manifest.
        const content = readSource(dashboard);
        assert.match(content, /function clampStatus/);
        assert.match(content, /if \(status === 'active'\) return 'passed';/);
        assert.match(content, /if \(status === 'pending'\) return 'skipped';/);
      });

      it('counts only truly-done tasks as complete and breaks out failed/skipped', () => {
        // A failed or skipped task must not read as forward progress: the Done badge counts
        // only `done`, with failed/skipped shown as a distinct breakdown.
        const content = readSource(dashboard);
        assert.match(content, /countIn\(\['done'\]\)/);
        assert.match(content, /done-breakdown/);
        assert.match(content, /seg-failed/, 'the progress bar segments failed separately from done');
      });
    });
  }

  it('backs its cross-model claim with a dispatch-time selection rule', () => {
    // The agent file asserts it "runs on a different model". Prose cannot make that true —
    // without a selection rule the duck runs on the same model as everyone before it and
    // its entire premise is silently void.
    const duck = readSource('.sdlc/agents/sdlc-rubber-duck.md');
    assert.match(duck, /different model/i);
    assert.match(duck, /rubber_duck_model/);
    assert.match(duck, /at call time/i);
    assert.match(duck, /Say so in the verdict/i, 'a same-model run must be disclosed, not passed off');
  });

  it('both model pins are documented as optional config keys', () => {
    const skill = readSource(SKILL);
    assert.match(skill, /architect_model/);
    assert.match(skill, /rubber_duck_model/);
    assert.match(skill, /tier alias/i);
  });

  it('the dashboard has exactly one copy in the repo', () => {
    const copies = execFileSync('git', ['ls-files', '*dashboard.html'], {
      cwd: SDLC_ROOT,
      encoding: 'utf8',
    })
      .split('\n')
      .filter(Boolean);
    assert.deepStrictEqual(copies, ['.sdlc/assets/server/dashboard.html'], `found: ${copies}`);
  });
});

// ---------------------------------------------------------------------------
// Context economy + design quality
// ---------------------------------------------------------------------------

describe('research delegates the codebase walk', () => {
  const RESEARCH = '.sdlc/skills/sdlc/references/research.md';

  it('dispatches a sub-agent rather than reading files inline', () => {
    const content = readSource(RESEARCH);
    assert.match(content, /Explore/);
    assert.match(content, /sub-agent/i);
  });

  it('explains that later phases share the window', () => {
    assert.match(readSource(RESEARCH), /context window|window that Design/i);
  });

  it('does not nest a dispatch when the phase is already a sub-agent', () => {
    // Two levels of nesting are capped or refused by many harnesses, and buy nothing:
    // the context being protected is discarded when the phase returns its summary.
    assert.match(readSource(RESEARCH), /already running in a sub-agent|itself running in a sub-agent/i);
    assert.match(readSource(RESEARCH), /nesting/i);
  });
});

describe('phase delegation', () => {
  const DISPATCH = '.sdlc/skills/sdlc/references/dispatch.md';

  it('the contract file exists', () => {
    assert.ok(fs.existsSync(path.join(SDLC_ROOT, DISPATCH)), `${DISPATCH} not found`);
  });

  it('clarify is excluded, because grilling needs a user to answer', () => {
    const content = readSource(DISPATCH);
    const row = content.split('\n').find((l) => /\|\s*\*\*Clarify\*\*/.test(l));
    assert.ok(row, 'Clarify row missing from the delegation table');
    assert.match(row, /\*\*No\*\*/, 'Clarify must not be delegatable');
    assert.match(row, /invent the answers/i, 'the reason must name the failure mode');
  });

  it('stop-gates stay with the orchestrator', () => {
    assert.match(readSource(DISPATCH), /Stop-gates never delegate/i);
  });

  it('the manifest has exactly one writer', () => {
    assert.match(readSource(DISPATCH), /orchestrator, always/i);
    assert.match(readSource(DISPATCH), /two writers/i);
  });

  it('sub-agents receive paths, not file contents', () => {
    // Reading an artifact into the orchestrator's window to hand it over spends
    // precisely the context the delegation exists to save.
    const content = readSource(DISPATCH);
    assert.match(content, /paths, not contents/i);
    assert.match(readSource(SKILL), /paths, never file contents/i);
  });

  it('a missing artifact is not reconstructed from the summary', () => {
    assert.match(readSource(DISPATCH), /do not synthesize the artifact/i);
  });

  it('SKILL.md routes phase execution through the contract', () => {
    const skill = readSource(SKILL);
    assert.match(skill, /references\/dispatch\.md/);
    assert.match(skill, /Runs in/, 'the phase table must say where each phase runs');
  });
});

describe('design phase', () => {
  const DESIGN = '.sdlc/skills/sdlc/references/design.md';
  const ARCHITECT = '.sdlc/skills/architect/SKILL.md';

  it('treats artifacts as candidates, not a fixed quota', () => {
    assert.match(readSource(DESIGN), /Candidates, Not a Quota/i);
  });

  it('requires a skipped artifact to record its reason', () => {
    const content = readSource(DESIGN);
    assert.match(content, /02-design\/README\.md/);
    assert.match(content, /skipped —/);
  });

  it('surfaces both produced and skipped artifacts at the stop-gate', () => {
    const gate = readSource(DESIGN).split('## Stop-Gate')[1];
    assert.match(gate, /skipped/i, 'the gate must show what was deliberately left out');
  });

  it('invokes design-it-twice for hard-to-reverse interfaces', () => {
    assert.match(readSource(DESIGN), /design-it-twice/i);
    assert.match(readSource(ARCHITECT), /Design it twice/i);
  });

  it('design-it-twice runs alternatives in sub-agents', () => {
    const section = readSource(ARCHITECT).split('### 2d.')[1].split('\n### ')[0];
    assert.match(section, /sub-agents/i);
    assert.match(section, /radically different/i);
  });

  it('design-it-twice detects the dispatch mode instead of assuming parallelism', () => {
    // implement.md already ladders Agent Teams → Copilot Fleet → Agent tool. Without the
    // same ladder here, a platform with no parallel dispatch has no defined behaviour and
    // the model improvises — most likely inline, which costs the full 3x tokens and
    // returns none of the isolation that justified spending them.
    const section = readSource(ARCHITECT).split('### 2d.')[1].split('\n### ')[0];
    for (const rung of ['Agent Teams', 'Copilot Fleet', 'Agent` tool']) {
      assert.ok(section.includes(rung), `dispatch ladder is missing: ${rung}`);
    }
  });

  it('separates the token win from the wall-clock win', () => {
    // Sequential sub-agents keep the whole token saving; parallelism only buys speed.
    // Conflating them makes "no parallel dispatch" read as "give up and inline".
    const section = readSource(ARCHITECT).split('### 2d.')[1].split('\n### ')[0];
    assert.match(section, /separate context windows/i);
    assert.match(section, /sequential sub-agents/i);
  });

  it('detects the model at call time instead of naming one from memory', () => {
    // A model named from training data ages badly: it may be retired, renamed, or
    // superseded by one the model has never heard of. The live list is whatever the
    // dispatch tool accepts right now.
    const section = readSource(ARCHITECT).split('### 2d.')[1].split('\n### ')[0];
    assert.match(section, /Detect, never recall/i);
    assert.match(section, /at call time/i);
    assert.match(section, /architect_model/);
  });

  it('pins tier aliases rather than versioned model ids', () => {
    // `opus` follows the tier as it advances; `claude-opus-4-8` freezes on one release.
    const section = readSource(ARCHITECT).split('### 2d.')[1].split('\n### ')[0];
    assert.match(section, /tier alias/i);
    assert.match(section, /never a versioned id/i);
    assert.ok(
      !/claude-[a-z]+-\d/.test(section),
      'a concrete versioned model id in the skill is exactly what goes stale',
    );
  });

  it('caps design-it-twice so it cannot eat the phase', () => {
    const section = readSource(ARCHITECT).split('### 2d.')[1].split('\n### ')[0];
    assert.match(section, /Budget/i);
    assert.match(section, /one\*\* round per interface/i);
  });

  it('ADRs are gated by the three-part test, not by "significant"', () => {
    const content = readSource(ARCHITECT);
    assert.match(content, /Hard to reverse/i);
    assert.match(content, /Surprising without context/i);
    assert.match(content, /real trade-off/i);
  });
});
