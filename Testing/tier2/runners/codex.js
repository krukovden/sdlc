// Testing/tier2/runners/codex.js
//
// OpenAI Codex runner — uses `codex exec --sandbox workspace-write`

const { runCodex, verifyToolAvailable } = require('../../helpers/cli-runner');

const name = 'codex';
const initPlatform = 'codex';

function isAvailable() {
  try { verifyToolAvailable('codex'); return true; } catch { return false; }
}

function run(type, description, cwd, { stopAt, timeout = 600000 } = {}) {
  return runCodex(`/sdlc ${type} "${description}"`, cwd, { stopAt, timeout });
}

module.exports = { name, initPlatform, isAvailable, run };
