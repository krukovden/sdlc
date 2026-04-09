'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { SDLC_ROOT } = require('../helpers/temp-project');
const fa = require('../helpers/file-assertions');

const HTML_PATH = path.join(SDLC_ROOT, 'docs', 'architecture.html');
const html = fs.readFileSync(HTML_PATH, 'utf8');

// ---------------------------------------------------------------------------
// Section headings
// ---------------------------------------------------------------------------
const SECTION_HEADINGS = [
  '0. What Is SDLC',
  '1. Cross-Platform Architecture',
  '2. Skill Discovery',
  '3. SDLC Workflow Phases',
  '4. Workflow Types',
  '5. Multi-Agent Implementation Pipeline',
  '6. Agent Context Isolation',
  '7. Artifact Flow',
  '8. Platform Capabilities',
];

describe('html-structure', () => {

  describe('section headings', () => {
    for (const heading of SECTION_HEADINGS) {
      it(`contains heading: "${heading}"`, () => {
        assert.ok(
          html.includes(heading),
          `Expected HTML to contain heading "${heading}"`,
        );
      });
    }
  });

  // ---------------------------------------------------------------------------
  // Section content
  // ---------------------------------------------------------------------------
  describe('section 0: What Is SDLC', () => {
    it('contains "Traditional SDLC"', () => {
      assert.ok(html.includes('Traditional SDLC'), 'Missing "Traditional SDLC"');
    });
    it('contains "This System"', () => {
      assert.ok(html.includes('This System'), 'Missing "This System"');
    });
  });

  describe('section 1: Cross-Platform Architecture', () => {
    for (const dir of ['.agents/', '.claude/', '.github/', '.codex/']) {
      it(`contains "${dir}"`, () => {
        assert.ok(html.includes(dir), `Missing "${dir}"`);
      });
    }
  });

  describe('section 2: Skill Discovery', () => {
    for (const tool of ['Claude Code', 'Copilot', 'Codex']) {
      it(`contains "${tool}"`, () => {
        assert.ok(html.includes(tool), `Missing "${tool}"`);
      });
    }
  });

  describe('section 3: SDLC Workflow Phases', () => {
    for (const phase of ['Clarify', 'Research', 'Design', 'Plan', 'Implement']) {
      it(`has phase-title for "${phase}"`, () => {
        const pattern = new RegExp(`class="phase-title"[^>]*>${phase}<`, 'i');
        // The actual HTML has inline styles: class="phase-title" style="..."
        // So we need a more flexible match
        const flexPattern = new RegExp(`class="phase-title"[\\s\\S]{0,50}?>${phase}<`);
        assert.ok(
          flexPattern.test(html),
          `Expected phase-title element containing "${phase}"`,
        );
      });
    }

    it('USER APPROVAL appears >= 5 times', () => {
      const matches = html.match(/USER APPROVAL/g) || [];
      assert.ok(
        matches.length >= 5,
        `Expected "USER APPROVAL" to appear >= 5 times, found ${matches.length}`,
      );
    });
  });

  describe('section 4: Workflow Types', () => {
    for (const type of ['Feature', 'Bugfix', 'Refactor', 'Spike']) {
      it(`contains workflow type "${type}"`, () => {
        assert.ok(html.includes(type), `Missing workflow type "${type}"`);
      });
    }

    it('contains class="inactive" (spike plan/implement)', () => {
      assert.ok(
        html.includes('class="inactive"'),
        'Missing class="inactive" for spike\'s disabled phases',
      );
    });
  });

  describe('section 5: Multi-Agent Implementation Pipeline', () => {
    for (const agent of ['LEAD', 'CODER', 'TESTER', 'REVIEWER', 'SECURITY']) {
      it(`contains agent name >${agent}<`, () => {
        assert.ok(
          html.includes(`>${agent}<`),
          `Missing agent name pattern ">${agent}<"`,
        );
      });
    }
  });

  describe('section 6: Agent Context Isolation', () => {
    const badges = ['Coder', 'Tester', 'Reviewer', 'Security'];
    for (const badge of badges) {
      it(`contains badge-agent">${badge}<`, () => {
        assert.ok(
          html.includes(`badge-agent">${badge}<`),
          `Missing badge pattern: badge-agent">${badge}<`,
        );
      });
    }
  });

  describe('section 7: Artifact Flow', () => {
    const artifacts = [
      'manifest.json',
      '00-clarify.md',
      '01-research.md',
      '02-design/',
      '03-plan.md',
      '04-implementation-log.md',
    ];
    for (const artifact of artifacts) {
      it(`contains artifact "${artifact}"`, () => {
        assert.ok(html.includes(artifact), `Missing artifact "${artifact}"`);
      });
    }
  });

  describe('section 7: cross-reference with feature.md workflow', () => {
    const featureWorkflowPath = path.join(SDLC_ROOT, '.agents', 'workflows', 'feature.md');
    const featureMd = fs.readFileSync(featureWorkflowPath, 'utf8');

    const featureArtifacts = [
      'architecture-diagrams.md',
      'architecture-decisions.md',
      'api-contracts.md',
      'storage-model.md',
      'testing-strategy.md',
      'standard-verifications.md',
    ];

    for (const artifact of featureArtifacts) {
      it(`"${artifact}" appears in both feature.md and architecture.html`, () => {
        assert.ok(
          featureMd.includes(artifact),
          `Artifact "${artifact}" not found in .agents/workflows/feature.md`,
        );
        assert.ok(
          html.includes(artifact),
          `Artifact "${artifact}" not found in docs/architecture.html`,
        );
      });
    }
  });

  describe('section 8: Platform Capabilities', () => {
    it('contains class="yes"', () => {
      assert.ok(html.includes('class="yes"'), 'Missing class="yes"');
    });
    it('contains class="no"', () => {
      assert.ok(html.includes('class="no"'), 'Missing class="no"');
    });
    it('contains "Isolated subagents"', () => {
      assert.ok(html.includes('Isolated subagents'), 'Missing "Isolated subagents"');
    });
  });

  // ---------------------------------------------------------------------------
  // HTML validity
  // ---------------------------------------------------------------------------
  describe('HTML validity', () => {
    it('has balanced HTML tags', () => {
      fa.assertValidHTML(SDLC_ROOT, path.join('docs', 'architecture.html'));
    });

    it('all CSS custom properties used via var() are defined in :root', () => {
      // Extract variables defined in :root { ... }
      const rootMatch = html.match(/:root\s*\{([^}]+)\}/);
      assert.ok(rootMatch, 'No :root block found in HTML');

      const rootBlock = rootMatch[1];
      const definedVars = new Set();
      const defPattern = /--([\w-]+)\s*:/g;
      let m;
      while ((m = defPattern.exec(rootBlock)) !== null) {
        definedVars.add(`--${m[1]}`);
      }

      // Extract all var(--name) usages from the entire HTML
      const usedVars = new Set();
      const usePattern = /var\((--[\w-]+)\)/g;
      while ((m = usePattern.exec(html)) !== null) {
        usedVars.add(m[1]);
      }

      for (const varName of usedVars) {
        assert.ok(
          definedVars.has(varName),
          `CSS variable "${varName}" is used via var() but not defined in :root`,
        );
      }
    });
  });
});
