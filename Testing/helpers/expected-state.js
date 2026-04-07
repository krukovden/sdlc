'use strict';

const fs = require('node:fs');
const path = require('node:path');

const SDLC_ROOT = require('./temp-project').SDLC_ROOT;

// --- Parse setup.js ---

const setupContent = fs.readFileSync(path.join(SDLC_ROOT, 'setup.js'), 'utf8');

// Extract agent names and their properties from AGENT_META
function parseAgentMeta() {
  // Find the AGENT_META block
  const metaMatch = setupContent.match(/const AGENT_META\s*=\s*\{([\s\S]*?)^\};/m);
  if (!metaMatch) throw new Error('Cannot find AGENT_META in setup.js');
  const block = metaMatch[1];

  const agents = {};
  // Match each agent entry: 'agent-name': { ... }
  const agentPattern = /'(sdlc-[\w-]+)':\s*\{([^}]*(?:\{[^}]*\}[^}]*)*)\}/g;
  let match;
  while ((match = agentPattern.exec(block)) !== null) {
    const name = match[1];
    const body = match[2];

    // Extract guidelines array
    const guidelinesMatch = body.match(/guidelines:\s*\[([^\]]+)\]/);
    const guidelines = guidelinesMatch
      ? guidelinesMatch[1].match(/'([^']+)'/g).map(s => s.replace(/'/g, ''))
      : [];

    // Extract codexReasoning if present
    const reasoningMatch = body.match(/codexReasoning:\s*'([^']+)'/);
    const codexReasoning = reasoningMatch ? reasoningMatch[1] : null;

    agents[name] = { guidelines, codexReasoning };
  }
  return agents;
}

// Extract command names from SLASH_COMMANDS
function parseSlashCommands() {
  const cmdMatch = setupContent.match(/const SLASH_COMMANDS\s*=\s*\{([\s\S]*?)^\};/m);
  if (!cmdMatch) throw new Error('Cannot find SLASH_COMMANDS in setup.js');
  const block = cmdMatch[1];
  const names = [];
  const pattern = /'([\w-]+)':\s*\{/g;
  let match;
  while ((match = pattern.exec(block)) !== null) {
    names.push(match[1]);
  }
  return names.sort();
}

// --- Parse .agents/workflows/*.md ---

function parseWorkflows() {
  const workflowsDir = path.join(SDLC_ROOT, '.agents', 'workflows');
  const workflows = {};

  for (const file of fs.readdirSync(workflowsDir).filter(f => f.endsWith('.md'))) {
    const name = file.replace('.md', '');
    const content = fs.readFileSync(path.join(workflowsDir, file), 'utf8');

    // Extract phases from the Phases table
    const phases = [...content.matchAll(/\|\s*\d+\s*\|\s*\*\*(\w+)\*\*/g)]
      .map(m => m[1].toLowerCase());

    // Extract design artifacts from Phase Outputs table
    const designArtifacts = [...content.matchAll(/\|\s*Design\s*\|\s*[^|]+\|\s*`([^`]+)`/g)]
      .map(m => m[1].replace('02-design/', ''))
      .sort();

    // Extract agent activation
    const activationSection = content.split(/##\s*Agent Activation/)[1] || '';
    const tableEnd = activationSection.indexOf('\n###') !== -1 ? activationSection.indexOf('\n###') : activationSection.length;
    const tableContent = activationSection.slice(0, tableEnd);
    const agentActivation = [...tableContent.matchAll(/\|\s*\*\*(\w+)\*\*\s*\|\s*(\w[^|]*)\|/g)]
      .map(r => ({ agent: r[1], activation: r[2].trim() }));

    // Check for pipeline diagram
    const hasPipeline = content.includes('Lead (dispatch) ->');

    workflows[name] = { phases, designArtifacts, agentActivation, hasPipeline };
  }
  return workflows;
}

// --- Parse .agents/ directory structure ---

function parseSkills() {
  const skillsDir = path.join(SDLC_ROOT, '.agents', 'skills');
  return fs.readdirSync(skillsDir, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name)
    .sort();
}

function parseGuidelines() {
  const guidelinesDir = path.join(SDLC_ROOT, '.agents', 'guidelines');
  return fs.readdirSync(guidelinesDir)
    .filter(f => f.endsWith('.md'))
    .sort();
}

function parseAgentFiles() {
  const agentsDir = path.join(SDLC_ROOT, '.agents', 'agents');
  return fs.readdirSync(agentsDir)
    .filter(f => f.endsWith('.md'))
    .map(f => f.replace('.md', ''))
    .sort();
}

// --- Build the full expected state ---

const agentMeta = parseAgentMeta();
const agentNames = Object.keys(agentMeta).sort();
const commandNames = parseSlashCommands();
const workflows = parseWorkflows();
const skills = parseSkills();
const allGuidelines = parseGuidelines();

// Build isolation rules: for each agent, compute "has" and "not" guidelines
const agentIsolation = {};
for (const [name, meta] of Object.entries(agentMeta)) {
  agentIsolation[name] = {
    has: meta.guidelines,
    not: allGuidelines.filter(g => !meta.guidelines.includes(g)),
  };
}

module.exports = {
  agentNames,
  agentMeta,
  agentIsolation,
  allGuidelines,
  commandNames,
  workflows,
  skills,
};
