// Testing/tier2/config.js
//
// Central configuration for tier2 integration tests.
// All workflow definitions, task descriptions, and timeouts live here.

const WORKFLOWS = {
  feature: {
    description: 'add POST /echo endpoint that returns the request body',
    phases: ['clarify', 'research', 'design', 'plan', 'implement'],
    timeout: 900000, // 15 min
  },
  bugfix: {
    description: 'GET /health returns 500 when no DB connection',
    phases: ['clarify', 'research', 'design', 'plan', 'implement'],
    timeout: 900000,
  },
  refactor: {
    description: 'extract health check into service layer',
    phases: ['clarify', 'research', 'design', 'plan', 'implement'],
    timeout: 900000,
  },
  spike: {
    description: 'evaluate logging libraries for Node.js',
    phases: ['clarify', 'research', 'design'],
    timeout: 600000, // 10 min
  },
};

// Ordered list of all phases (for stop-at truncation)
const ALL_PHASES = ['clarify', 'research', 'design', 'plan', 'implement'];

// Read stop-at-phase from env: SDLC_STOP_AT=design
const STOP_AT = process.env.SDLC_STOP_AT || null;

/**
 * Get the effective phase list for a workflow, truncated by stopAt.
 */
function getEffectivePhases(workflowType, stopAt) {
  const wf = WORKFLOWS[workflowType];
  if (!wf) throw new Error(`Unknown workflow type: ${workflowType}`);

  if (!stopAt) return wf.phases;

  const stopIdx = ALL_PHASES.indexOf(stopAt);
  if (stopIdx === -1) throw new Error(`Unknown phase: ${stopAt}`);

  return wf.phases.filter(p => ALL_PHASES.indexOf(p) <= stopIdx);
}

module.exports = { WORKFLOWS, ALL_PHASES, STOP_AT, getEffectivePhases };
