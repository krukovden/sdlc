'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { SDLC_ROOT } = require('../helpers/temp-project');

function read(relPath) {
  return fs.readFileSync(path.join(SDLC_ROOT, relPath), 'utf8');
}

function frontmatter(content) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(content);
  return match ? match[1] : '';
}

const SKILLS_DIR = path.join(SDLC_ROOT, '.sdlc', 'skills');
const skills = fs
  .readdirSync(SKILLS_DIR, { withFileTypes: true })
  .filter((e) => e.isDirectory() && fs.existsSync(path.join(SKILLS_DIR, e.name, 'SKILL.md')))
  .map((e) => e.name);

// ---------------------------------------------------------------------------
// Skills are auto-discovered — no registry to catch a mistake, so the shape of
// SKILL.md is the only contract. These lock in what setup.js actually relies on.
// ---------------------------------------------------------------------------

describe('skill conventions', () => {
  it('finds skills to check', () => assert.ok(skills.length > 0));

  for (const name of skills) {
    describe(name, () => {
      const meta = frontmatter(read(`.sdlc/skills/${name}/SKILL.md`));

      it('frontmatter name matches the folder', () => {
        // discoverSkills() keys the skill by its FOLDER name and never checks the
        // frontmatter, so a mismatch is invisible until something reads the wrong one.
        const declared = /^name:\s*(.+)$/m.exec(meta);
        assert.ok(declared, 'SKILL.md has no name in frontmatter');
        assert.strictEqual(declared[1].trim(), name);
      });

      it('description carries a label before the first em dash', () => {
        // setup.js splits the description on the first ' — ' and uses the left side as
        // the skill's label in the generated CLAUDE.md table. Without one, the whole
        // sentence becomes the label — or the folder name does.
        const declared = /^description:\s*(.+)$/m.exec(meta);
        assert.ok(declared, 'SKILL.md has no description in frontmatter');
        const [label] = declared[1].split(' — ');
        assert.notStrictEqual(label, declared[1], 'no " — " separator in the description');
        assert.ok(label.trim().length > 0 && label.length < 80, `unusable table label: "${label}"`);
      });
    });
  }
});

// ---------------------------------------------------------------------------
// AGENTS.md is duplicated into .github/copilot-instructions.md because Copilot
// has no import mechanism. The repo's own rule is to run `npm run sync:copilot`
// after editing it — but nothing enforced that, so forgetting it left Copilot
// reading stale guidance with no signal.
// ---------------------------------------------------------------------------

describe('contributor docs', () => {
  it('copilot-instructions.md is in sync with AGENTS.md', () => {
    assert.strictEqual(
      read('.github/copilot-instructions.md'),
      read('AGENTS.md'),
      'run `npm run sync:copilot`',
    );
  });

  it('documents how to add a skill, not just a role', () => {
    const agents = read('AGENTS.md');
    assert.match(agents, /## Adding a new SDLC role/);
    assert.match(agents, /## Adding a new skill/);
  });

  it('says skills need no registry entry', () => {
    // The one thing that genuinely differs from adding a role, and the step someone
    // coming from the role procedure would go looking for.
    assert.match(read('AGENTS.md'), /auto-discovered/i);
    assert.match(read('AGENTS.md'), /no registry entry|no `setup\.js` edit/i);
  });
});

describe('attribution', () => {
  it('ATTRIBUTION.md exists', () => {
    assert.ok(fs.existsSync(path.join(SDLC_ROOT, 'ATTRIBUTION.md')));
  });

  it('records the vendored skill and reproduces its licence', () => {
    const attribution = read('ATTRIBUTION.md');
    assert.match(attribution, /mattpocock\/skills/);
    // A character class escapes the dot here instead of a backslash. The scan in
    // server.test.js is a plain substring search, and a backslash-escaped dot in a
    // regex reads identically to the string-literal bug it hunts for — keeping that
    // sequence absent everywhere, regexes included, is the point.
    assert.match(attribution, /[.]sdlc\/skills\/grilling\//);
    assert.match(attribution, /MIT License/, 'the licence text must travel with the derived work');
  });
});
