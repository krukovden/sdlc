'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { create } = require('../helpers/temp-project');
const state = require('../helpers/expected-state');

const EXPECTED_AGENTS = state.agentNames;
const EXPECTED_COMMANDS = state.commandNames;
const GUIDELINES = state.allGuidelines;

const AGENT_KEYWORDS = {
  'sdlc-lead':         (content) => content.includes('orchestrat'),
  'sdlc-coder':        (content) => content.includes('implementation') || content.includes('writes code'),
  'sdlc-tester':       (content) => content.includes('test'),
  'sdlc-reviewer':     (content) => content.includes('review'),
  'sdlc-security':     (content) => content.includes('security'),
  'sdlc-rubber-duck':  (content) => content.includes('second-opinion') || content.includes('different model') || content.includes('rubber'),
};

const PHASE_NAMES = ['clarify', 'research', 'design', 'plan', 'implement'];

describe('cross-platform', () => {
  let proj;

  before(async () => {
    proj = await create({ tier: 1, tool: 'all' });
  });

  after(() => {
    proj.cleanup();
  });

  // ---------------------------------------------------------------------------
  // Test 1: same 5 agents across all platforms
  // ---------------------------------------------------------------------------
  it(`same ${EXPECTED_AGENTS.length} agents across all platforms`, () => {
    const claudeDir = path.join(proj.dir, '.claude', 'agents');
    const copilotDir = path.join(proj.dir, '.github', 'agents');
    const codexDir = path.join(proj.dir, '.codex', 'agents');

    const claudeAgents = fs.readdirSync(claudeDir)
      .filter(f => f.endsWith('.md'))
      .map(f => f.replace(/\.md$/, ''))
      .sort();

    const copilotAgents = fs.readdirSync(copilotDir)
      .filter(f => f.endsWith('.agent.md'))
      .map(f => f.replace(/\.agent\.md$/, ''))
      .sort();

    const codexAgents = fs.readdirSync(codexDir)
      .filter(f => f.endsWith('.toml'))
      .map(f => f.replace(/\.toml$/, ''))
      .sort();

    assert.deepStrictEqual(claudeAgents, EXPECTED_AGENTS,
      `Claude agents mismatch. Expected: ${JSON.stringify(EXPECTED_AGENTS)}, got: ${JSON.stringify(claudeAgents)}`);

    assert.deepStrictEqual(copilotAgents, EXPECTED_AGENTS,
      `Copilot agents mismatch. Expected: ${JSON.stringify(EXPECTED_AGENTS)}, got: ${JSON.stringify(copilotAgents)}`);

    assert.deepStrictEqual(codexAgents, EXPECTED_AGENTS,
      `Codex agents mismatch. Expected: ${JSON.stringify(EXPECTED_AGENTS)}, got: ${JSON.stringify(codexAgents)}`);
  });

  // ---------------------------------------------------------------------------
  // Test 2: same 7 commands across Claude and Copilot
  // ---------------------------------------------------------------------------
  it(`same ${EXPECTED_COMMANDS.length} commands across Claude and Copilot`, () => {
    const commandsDir = path.join(proj.dir, '.claude', 'commands');
    const promptsDir = path.join(proj.dir, '.github', 'prompts');

    const claudeCommands = fs.readdirSync(commandsDir)
      .filter(f => f.endsWith('.md'))
      .map(f => f.replace(/\.md$/, ''))
      .sort();

    const copilotCommands = fs.readdirSync(promptsDir)
      .filter(f => f.endsWith('.prompt.md'))
      .map(f => f.replace(/\.prompt\.md$/, ''))
      .sort();

    assert.deepStrictEqual(claudeCommands, EXPECTED_COMMANDS,
      `Claude commands mismatch. Expected: ${JSON.stringify(EXPECTED_COMMANDS)}, got: ${JSON.stringify(claudeCommands)}`);

    assert.deepStrictEqual(copilotCommands, EXPECTED_COMMANDS,
      `Copilot commands mismatch. Expected: ${JSON.stringify(EXPECTED_COMMANDS)}, got: ${JSON.stringify(copilotCommands)}`);

    assert.deepStrictEqual(claudeCommands, copilotCommands,
      `Claude and Copilot commands differ.\n  Claude:  ${JSON.stringify(claudeCommands)}\n  Copilot: ${JSON.stringify(copilotCommands)}`);
  });

  // ---------------------------------------------------------------------------
  // Test 3: description consistent across platforms (per agent)
  // ---------------------------------------------------------------------------
  for (const agentName of EXPECTED_AGENTS) {
    it(`description consistent across platforms: ${agentName}`, () => {
      const claudeContent = fs.readFileSync(
        path.join(proj.dir, '.claude', 'agents', `${agentName}.md`), 'utf8'
      ).toLowerCase();

      const copilotContent = fs.readFileSync(
        path.join(proj.dir, '.github', 'agents', `${agentName}.agent.md`), 'utf8'
      ).toLowerCase();

      const codexContent = fs.readFileSync(
        path.join(proj.dir, '.codex', 'agents', `${agentName}.toml`), 'utf8'
      ).toLowerCase();

      const check = AGENT_KEYWORDS[agentName];

      assert.ok(check(claudeContent),
        `Claude agent "${agentName}" missing expected keyword. Content preview: "${claudeContent.slice(0, 200)}"`);

      assert.ok(check(copilotContent),
        `Copilot agent "${agentName}" missing expected keyword. Content preview: "${copilotContent.slice(0, 200)}"`);

      assert.ok(check(codexContent),
        `Codex agent "${agentName}" missing expected keyword. Content preview: "${codexContent.slice(0, 200)}"`);
    });
  }

  // ---------------------------------------------------------------------------
  // Test 4: same guideline assignments per agent across platforms
  // ---------------------------------------------------------------------------
  for (const agentName of EXPECTED_AGENTS) {
    it(`same guideline assignments per agent across platforms: ${agentName}`, () => {
      const claudeContent = fs.readFileSync(
        path.join(proj.dir, '.claude', 'agents', `${agentName}.md`), 'utf8'
      );

      const copilotContent = fs.readFileSync(
        path.join(proj.dir, '.github', 'agents', `${agentName}.agent.md`), 'utf8'
      );

      const codexContent = fs.readFileSync(
        path.join(proj.dir, '.codex', 'agents', `${agentName}.toml`), 'utf8'
      );

      function extractGuidelines(content) {
        return GUIDELINES.filter(g => content.includes(g)).sort();
      }

      const claudeGuidelines = extractGuidelines(claudeContent);
      const copilotGuidelines = extractGuidelines(copilotContent);
      const codexGuidelines = extractGuidelines(codexContent);

      assert.deepStrictEqual(claudeGuidelines, copilotGuidelines,
        `Agent "${agentName}" guideline mismatch between Claude and Copilot.\n  Claude:  ${JSON.stringify(claudeGuidelines)}\n  Copilot: ${JSON.stringify(copilotGuidelines)}`);

      assert.deepStrictEqual(claudeGuidelines, codexGuidelines,
        `Agent "${agentName}" guideline mismatch between Claude and Codex.\n  Claude: ${JSON.stringify(claudeGuidelines)}\n  Codex:  ${JSON.stringify(codexGuidelines)}`);
    });
  }

  // ---------------------------------------------------------------------------
  // Test 5: workflow phase sequence matches across Claude and Copilot
  //
  // Claude expresses phases via individual per-phase command files
  // (sdlc-clarify.md, sdlc-research.md, etc.) rather than in sdlc.md itself.
  // We verify Claude has a dedicated command file for each phase, and that the
  // Copilot sdlc.prompt.md (which has the full phase list in its description)
  // contains all 5 phase names. Both collectively represent the same sequence.
  // ---------------------------------------------------------------------------
  it('workflow phase sequence matches across Claude and Copilot', () => {
    const claudeCommandsDir = path.join(proj.dir, '.claude', 'commands');
    const claudeCommandFiles = fs.readdirSync(claudeCommandsDir)
      .filter(f => f.endsWith('.md'))
      .map(f => f.replace(/\.md$/, ''));

    const copilotSdlc = fs.readFileSync(
      path.join(proj.dir, '.github', 'prompts', 'sdlc.prompt.md'), 'utf8'
    ).toLowerCase();

    for (const phase of PHASE_NAMES) {
      // Claude: each phase has its own command file (sdlc-<phase>.md)
      const phaseCommand = `sdlc-${phase}`;
      assert.ok(claudeCommandFiles.includes(phaseCommand),
        `Claude missing command file for phase "${phase}" (expected sdlc-${phase}.md in .claude/commands/)`);

      // Copilot: sdlc.prompt.md description lists all phases inline
      assert.ok(copilotSdlc.includes(phase),
        `Copilot sdlc.prompt.md missing phase name: "${phase}"`);
    }
  });
});
