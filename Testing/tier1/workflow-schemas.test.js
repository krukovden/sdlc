'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SDLC_ROOT = require('../helpers/temp-project').SDLC_ROOT;
const WORKFLOWS_DIR = path.join(SDLC_ROOT, '.agents', 'workflows');

function readWorkflow(name) {
  return fs.readFileSync(path.join(WORKFLOWS_DIR, `${name}.md`), 'utf8');
}

// Extract phase names from Phases table. Lines like "| 1 | **Clarify** | Lead |"
function extractPhases(content) {
  const matches = [...content.matchAll(/\|\s*\d+\s*\|\s*\*\*(\w+)\*\*/g)];
  return matches.map(m => m[1].toLowerCase());
}

// Extract design artifact filenames from Phase Outputs table
// Lines like "| Design | Architecture diagrams | `02-design/architecture-diagrams.md` |"
function extractDesignArtifacts(content) {
  const matches = [...content.matchAll(/\|\s*Design\s*\|\s*[^|]+\|\s*`([^`]+)`/g)];
  return matches.map(m => m[1].replace('02-design/', ''));
}

// Extract agent activation rows from Agent Activation section
function extractAgentActivation(content) {
  const section = content.split(/##\s*Agent Activation/)[1];
  if (!section) return [];
  const tableEnd = section.indexOf('\n###') !== -1 ? section.indexOf('\n###') : section.length;
  const tableContent = section.slice(0, tableEnd);
  const rows = [...tableContent.matchAll(/\|\s*\*\*(\w+)\*\*\s*\|\s*(\w[^|]*)\|/g)];
  return rows.map(r => ({ agent: r[1], activation: r[2].trim() }));
}

describe('workflow-schemas', () => {
  describe('phase definitions', () => {
    const fivePhases = ['clarify', 'research', 'design', 'plan', 'implement'];

    it('Feature has 5 phases', () => {
      const phases = extractPhases(readWorkflow('feature'));
      assert.deepStrictEqual(phases, fivePhases);
    });

    it('Bugfix has 5 phases', () => {
      const phases = extractPhases(readWorkflow('bugfix'));
      assert.deepStrictEqual(phases, fivePhases);
    });

    it('Refactor has 5 phases', () => {
      const phases = extractPhases(readWorkflow('refactor'));
      assert.deepStrictEqual(phases, fivePhases);
    });

    it('Spike has 3 phases', () => {
      const phases = extractPhases(readWorkflow('spike'));
      assert.deepStrictEqual(phases, ['clarify', 'research', 'design']);
    });
  });

  describe('design artifacts', () => {
    it('Feature has 6 design artifacts (sorted)', () => {
      const artifacts = extractDesignArtifacts(readWorkflow('feature')).sort();
      assert.deepStrictEqual(artifacts, [
        'api-contracts.md',
        'architecture-decisions.md',
        'architecture-diagrams.md',
        'standard-verifications.md',
        'storage-model.md',
        'testing-strategy.md',
      ]);
    });

    it('Bugfix has 5 design artifacts (sorted)', () => {
      const artifacts = extractDesignArtifacts(readWorkflow('bugfix')).sort();
      assert.deepStrictEqual(artifacts, [
        'blast-radius.md',
        'fix-strategy.md',
        'regression-test-plan.md',
        'root-cause.md',
        'standard-verifications.md',
      ]);
    });

    it('Refactor has 5 design artifacts (sorted)', () => {
      const artifacts = extractDesignArtifacts(readWorkflow('refactor')).sort();
      assert.deepStrictEqual(artifacts, [
        'before-after.md',
        'migration-path.md',
        'standard-verifications.md',
        'target-architecture.md',
        'testing-strategy.md',
      ]);
    });

    it('Spike has 2 design artifacts (sorted)', () => {
      const artifacts = extractDesignArtifacts(readWorkflow('spike')).sort();
      assert.deepStrictEqual(artifacts, [
        'options-analysis.md',
        'recommendation.md',
      ]);
    });
  });

  describe('agent activation', () => {
    it('Feature: 5 agents, all "Always"', () => {
      const agents = extractAgentActivation(readWorkflow('feature'));
      assert.strictEqual(agents.length, 5, `Expected 5 agents, got ${agents.length}`);
      for (const { agent, activation } of agents) {
        assert.strictEqual(activation, 'Always', `Expected ${agent} to be "Always", got "${activation}"`);
      }
    });

    it('Bugfix: 5 agents, all "Always"', () => {
      const agents = extractAgentActivation(readWorkflow('bugfix'));
      assert.strictEqual(agents.length, 5, `Expected 5 agents, got ${agents.length}`);
      for (const { agent, activation } of agents) {
        assert.strictEqual(activation, 'Always', `Expected ${agent} to be "Always", got "${activation}"`);
      }
    });

    it('Refactor: Security is "Optional"', () => {
      const agents = extractAgentActivation(readWorkflow('refactor'));
      const security = agents.find(a => a.agent === 'Security');
      assert.ok(security, 'Security agent row not found');
      assert.ok(
        security.activation.includes('Optional'),
        `Expected Security activation to include "Optional", got "${security.activation}"`,
      );
    });

    it('Spike: Lead is "Always", others include "Not activated"', () => {
      const agents = extractAgentActivation(readWorkflow('spike'));
      const lead = agents.find(a => a.agent === 'Lead');
      assert.ok(lead, 'Lead agent row not found');
      assert.strictEqual(lead.activation, 'Always', `Expected Lead to be "Always", got "${lead.activation}"`);

      const others = agents.filter(a => a.agent !== 'Lead');
      for (const { agent, activation } of others) {
        assert.ok(
          activation.includes('Not activated'),
          `Expected ${agent} activation to include "Not activated", got "${activation}"`,
        );
      }
    });
  });

  describe('structural elements', () => {
    it('All 4 workflows have "## Agent Activation" section', () => {
      for (const name of ['feature', 'bugfix', 'refactor', 'spike']) {
        const content = readWorkflow(name);
        assert.ok(
          content.includes('## Agent Activation'),
          `${name}.md missing "## Agent Activation" section`,
        );
      }
    });

    it('All 4 workflows have "docs/workflows/" in content', () => {
      for (const name of ['feature', 'bugfix', 'refactor', 'spike']) {
        const content = readWorkflow(name);
        assert.ok(
          content.includes('docs/workflows/'),
          `${name}.md missing "docs/workflows/" reference`,
        );
      }
    });

    it('Feature, bugfix, refactor have "Lead (dispatch) ->" pipeline diagram', () => {
      for (const name of ['feature', 'bugfix', 'refactor']) {
        const content = readWorkflow(name);
        assert.ok(
          content.includes('Lead (dispatch) ->'),
          `${name}.md missing "Lead (dispatch) ->" pipeline diagram`,
        );
      }
    });

    it('Spike does NOT have "Lead (dispatch) ->"', () => {
      const content = readWorkflow('spike');
      assert.ok(
        !content.includes('Lead (dispatch) ->'),
        'spike.md should not have "Lead (dispatch) ->" pipeline diagram',
      );
    });
  });
});
