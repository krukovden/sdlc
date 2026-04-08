// Testing/tier2/runners/claude.js
//
// Claude Code runner — uses `claude -p "prompt" --dangerously-skip-permissions`

const { runClaude, verifyToolAvailable } = require('../../helpers/cli-runner');

const name = 'claude';
const initPlatform = 'claude';

function isAvailable() {
  try { verifyToolAvailable('claude'); return true; } catch { return false; }
}

function run(type, description, cwd, { stopAt, timeout = 600000 } = {}) {
  return runClaude(`/sdlc ${type} "${description}"`, cwd, { stopAt, timeout });
}

module.exports = { name, initPlatform, isAvailable, run };
