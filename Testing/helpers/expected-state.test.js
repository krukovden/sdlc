'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const state = require('./expected-state');

describe('expected-state parser', () => {
  it('finds agents in setup.js', () => {
    assert.ok(state.agentNames.length >= 5, `Found ${state.agentNames.length} agents`);
    assert.ok(state.agentNames.includes('sdlc-lead'));
    assert.ok(state.agentNames.includes('sdlc-coder'));
  });

  it('parses guidelines per agent', () => {
    for (const name of state.agentNames) {
      assert.ok(state.agentMeta[name].guidelines.length >= 1, `${name} has no guidelines`);
    }
  });

  it('builds isolation rules', () => {
    for (const name of state.agentNames) {
      const rules = state.agentIsolation[name];
      assert.ok(rules.has.length >= 1, `${name} has no "has" guidelines`);
      assert.ok(rules.not.length >= 1, `${name} has no "not" guidelines`);
      // has + not should cover all guidelines
      assert.strictEqual(rules.has.length + rules.not.length, state.allGuidelines.length);
    }
  });

  it('finds commands in setup.js', () => {
    assert.ok(state.commandNames.length >= 7, `Found ${state.commandNames.length} commands`);
    assert.ok(state.commandNames.includes('sdlc'));
  });

  it('parses all workflow types', () => {
    assert.ok('feature' in state.workflows);
    assert.ok('bugfix' in state.workflows);
    assert.ok('refactor' in state.workflows);
    assert.ok('spike' in state.workflows);
    for (const [name, wf] of Object.entries(state.workflows)) {
      assert.ok(wf.phases.length >= 3, `${name} has fewer than 3 phases`);
      assert.ok(wf.designArtifacts.length >= 1, `${name} has no design artifacts`);
    }
  });

  it('finds skills', () => {
    assert.ok(state.skills.length >= 10, `Found ${state.skills.length} skills`);
  });

  it('finds guidelines', () => {
    assert.ok(state.allGuidelines.length >= 4, `Found ${state.allGuidelines.length} guidelines`);
  });

  it('detects codexReasoning', () => {
    assert.strictEqual(state.agentMeta['sdlc-lead'].codexReasoning, 'high');
    // Non-lead agents should NOT have it
    for (const name of state.agentNames.filter(n => n !== 'sdlc-lead')) {
      assert.strictEqual(state.agentMeta[name].codexReasoning, null, `${name} should not have codexReasoning`);
    }
  });
});
