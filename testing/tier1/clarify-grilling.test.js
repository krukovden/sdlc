'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { SDLC_ROOT } = require('../helpers/temp-project');

function readSource(relPath) {
  return fs.readFileSync(path.join(SDLC_ROOT, relPath), 'utf8');
}

const GRILLING = '.sdlc/skills/grilling/SKILL.md';
const CLARIFY = '.sdlc/skills/sdlc/references/clarify.md';
const RESEARCH = '.sdlc/skills/sdlc/references/research.md';
const DESIGN = '.sdlc/skills/sdlc/references/design.md';
const ARCHITECT = '.sdlc/skills/architect/SKILL.md';

// ---------------------------------------------------------------------------
// grilling skill — the method the Clarify phase runs on
// ---------------------------------------------------------------------------

describe('grilling skill contracts', () => {
  it('file exists in .sdlc/skills/', () => {
    assert.ok(fs.existsSync(path.join(SDLC_ROOT, GRILLING)), `${GRILLING} not found`);
  });

  it('is discoverable — frontmatter name matches the folder', () => {
    const content = readSource(GRILLING);
    const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(content);
    assert.ok(match, 'SKILL.md must open with a frontmatter block');
    assert.match(match[1], /^name:\s*grilling\s*$/m, 'frontmatter name must be "grilling"');
    assert.match(match[1], /^description:\s*\S/m, 'frontmatter must carry a description');
  });

  it('carries all four rules of the method', () => {
    const content = readSource(GRILLING);
    // Each rule is load-bearing: dropping any one is what turns a grilling session
    // back into a shallow checklist pass.
    assert.match(content, /one question at a time/i, 'missing: one question at a time');
    assert.match(content, /recommend/i, 'missing: recommend an answer with every question');
    assert.match(content, /look .*up|discoverable/i, 'missing: look facts up rather than asking');
    assert.match(content, /depth before breadth/i, 'missing: depth before breadth');
  });

  it('separates facts from decisions', () => {
    const content = readSource(GRILLING);
    assert.match(content, /decisions?/i);
    assert.match(content, /assumption/i, 'must name what an unconfirmed conclusion is');
  });
});

// ---------------------------------------------------------------------------
// Clarify phase — wired to grilling, with a checkable stopping condition
// ---------------------------------------------------------------------------

describe('clarify phase contracts', () => {
  it('delegates its method to the grilling skill', () => {
    assert.match(
      readSource(CLARIFY),
      /skills\/grilling\/SKILL\.md/,
      'clarify.md must point at the grilling skill rather than restating the method',
    );
  });

  it('has a completion criterion', () => {
    assert.match(readSource(CLARIFY), /## Completion Criterion/);
  });

  it('the completion criterion is a checkable list, not prose', () => {
    const section = readSource(CLARIFY).split('## Completion Criterion')[1].split('\n## ')[0];
    const boxes = (section.match(/^- \[ \]/gm) || []).length;
    assert.ok(boxes >= 4, `expected at least 4 checkboxes, found ${boxes}`);
  });

  it('requires success criteria to be testable as written', () => {
    assert.match(readSource(CLARIFY), /testable as written/i);
  });

  it('the artifact template separates Assumptions from Key Decisions', () => {
    const content = readSource(CLARIFY);
    assert.match(content, /## Key Decisions Made/);
    assert.match(content, /## Assumptions \(unverified\)/);
    assert.ok(
      content.indexOf('## Assumptions (unverified)') > content.indexOf('## Key Decisions Made'),
      'Assumptions must follow Decisions in the template',
    );
  });

  it('surfaces assumptions at the stop-gate, not only in the artifact', () => {
    const gate = readSource(CLARIFY).split('## Stop-Gate')[1];
    assert.match(gate, /Assumptions/, 'the stop-gate must show what the phase could not settle');
  });

  it('tells auto-approve mode to record gaps instead of inventing answers', () => {
    const gate = readSource(CLARIFY).split('## Stop-Gate')[1];
    assert.match(gate, /auto-approve/);
    assert.match(gate, /Assumptions/);
  });
});

// ---------------------------------------------------------------------------
// Deep-module vocabulary and refactor heuristics
// ---------------------------------------------------------------------------

describe('architect skill vocabulary', () => {
  const terms = ['Module', 'Interface', 'Seam', 'Adapter', 'Depth', 'Leverage', 'Locality'];
  for (const term of terms) {
    it(`defines "${term}"`, () => {
      assert.match(readSource(ARCHITECT), new RegExp(`\\*\\*${term}\\*\\*`));
    });
  }

  it('prefers seam over the overloaded word boundary', () => {
    assert.match(readSource(ARCHITECT), /say seam, not boundary/i);
  });

  it('carries the deletion test', () => {
    assert.match(readSource(ARCHITECT), /deletion test/i);
  });

  it('guards against single-adapter seams', () => {
    assert.match(readSource(ARCHITECT), /one adapter means a hypothetical seam/i);
  });

  it('classifies dependencies to place the seam', () => {
    const content = readSource(ARCHITECT);
    for (const category of ['In-process', 'Local-substitutable', 'Remote but owned', 'True external']) {
      assert.ok(content.includes(category), `missing dependency category: ${category}`);
    }
  });
});

describe('refactor phase heuristics', () => {
  it('research scopes by churn before scanning', () => {
    const content = readSource(RESEARCH);
    assert.match(content, /hot spot/i, 'refactor research must weight the parts that keep changing');
    assert.match(content, /git log/);
  });

  it('research applies the deletion test', () => {
    assert.match(readSource(RESEARCH), /deletion test/i);
  });

  it('design requires tests to be deleted, not only added', () => {
    const content = readSource(DESIGN);
    assert.match(content, /## Replace, Don't Layer/);
    assert.match(content, /\*\*Delete\*\*/, 'the testing strategy must name tests for deletion');
  });

  it("the Tester agent is named as the consumer of that instruction", () => {
    const section = readSource(DESIGN).split("## Replace, Don't Layer")[1].split('\n## ')[0];
    assert.match(section, /Tester/, 'an instruction with no named consumer does not get executed');
  });
});
