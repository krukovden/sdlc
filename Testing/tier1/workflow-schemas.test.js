'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SDLC_ROOT = require('../helpers/temp-project').SDLC_ROOT;
const state = require('../helpers/expected-state');
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
    for (const [name, wf] of Object.entries(state.workflows)) {
      it(`${name} has ${wf.phases.length} phases`, () => {
        const phases = extractPhases(readWorkflow(name));
        assert.deepStrictEqual(phases, wf.phases);
      });
    }
  });

  describe('design artifacts', () => {
    for (const [name, wf] of Object.entries(state.workflows)) {
      it(`${name} has ${wf.designArtifacts.length} design artifacts (sorted)`, () => {
        const artifacts = extractDesignArtifacts(readWorkflow(name)).sort();
        assert.deepStrictEqual(artifacts, wf.designArtifacts);
      });
    }
  });

  describe('agent activation', () => {
    for (const [name, wf] of Object.entries(state.workflows)) {
      it(`${name}: agent activation matches parsed state`, () => {
        const agents = extractAgentActivation(readWorkflow(name));
        assert.strictEqual(
          agents.length,
          wf.agentActivation.length,
          `Expected ${wf.agentActivation.length} agent activation rows, got ${agents.length}`,
        );
        for (let i = 0; i < agents.length; i++) {
          assert.strictEqual(
            agents[i].agent,
            wf.agentActivation[i].agent,
            `Row ${i}: agent mismatch`,
          );
          assert.strictEqual(
            agents[i].activation,
            wf.agentActivation[i].activation,
            `Row ${i} (${agents[i].agent}): activation mismatch`,
          );
        }
      });
    }
  });

  describe('structural elements', () => {
    it('All workflows have "## Agent Activation" section', () => {
      for (const name of Object.keys(state.workflows)) {
        const content = readWorkflow(name);
        assert.ok(
          content.includes('## Agent Activation'),
          `${name}.md missing "## Agent Activation" section`,
        );
      }
    });

    it('All workflows have "docs/workflows/" in content', () => {
      for (const name of Object.keys(state.workflows)) {
        const content = readWorkflow(name);
        assert.ok(
          content.includes('docs/workflows/'),
          `${name}.md missing "docs/workflows/" reference`,
        );
      }
    });

    it('Workflows with pipeline diagram have "Lead (dispatch) ->"', () => {
      for (const [name, wf] of Object.entries(state.workflows)) {
        const content = readWorkflow(name);
        if (wf.hasPipeline) {
          assert.ok(
            content.includes('Lead (dispatch) ->'),
            `${name}.md missing "Lead (dispatch) ->" pipeline diagram`,
          );
        } else {
          assert.ok(
            !content.includes('Lead (dispatch) ->'),
            `${name}.md should not have "Lead (dispatch) ->" pipeline diagram`,
          );
        }
      }
    });
  });
});
