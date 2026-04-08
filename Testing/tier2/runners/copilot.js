// Testing/tier2/runners/copilot.js
//
// GitHub Copilot runner — uses `gh copilot -- -p "prompt" --allow-all`

const { runCopilot, verifyToolAvailable } = require('../../helpers/cli-runner');

const name = 'copilot';
const initPlatform = 'copilot';

function isAvailable() {
  try { verifyToolAvailable('copilot'); return true; } catch { return false; }
}

function run(type, description, cwd, { stopAt, timeout = 600000 } = {}) {
  return runCopilot(`/sdlc ${type} "${description}"`, cwd, { stopAt, timeout });
}

module.exports = { name, initPlatform, isAvailable, run };
