// Testing/tier2/runners/index.js
//
// Runner registry — provides unified access to all tool runners.

const claude = require('./claude');
const copilot = require('./copilot');
const codex = require('./codex');

const ALL_RUNNERS = { claude, copilot, codex };

/**
 * Get runners filtered by SDLC_TEST_TOOL env var.
 * Returns array of { name, initPlatform, isAvailable, run } objects.
 */
function getRunners() {
  const toolFilter = process.env.SDLC_TEST_TOOL;
  if (toolFilter) {
    const runner = ALL_RUNNERS[toolFilter];
    if (!runner) throw new Error(`Unknown tool: ${toolFilter}. Available: ${Object.keys(ALL_RUNNERS).join(', ')}`);
    return [runner];
  }
  return Object.values(ALL_RUNNERS);
}

module.exports = { ALL_RUNNERS, getRunners };
