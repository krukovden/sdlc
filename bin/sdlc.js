#!/usr/bin/env node

const path = require('path');

const command = process.argv[2];
const args = process.argv.slice(3);

const COMMANDS = {
  init: 'Initialize SDLC system in current project',
  help: 'Show this help message',
};

function showHelp() {
  console.log('\n  sdlc — AI-powered SDLC multi-agent system\n');
  console.log('  Usage: npx sdlc <command> [options]\n');
  console.log('  Commands:');
  for (const [cmd, desc] of Object.entries(COMMANDS)) {
    console.log(`    ${cmd.padEnd(10)} ${desc}`);
  }
  console.log('\n  Init options:');
  console.log('    npx sdlc init                 Interactive prompt');
  console.log('    npx sdlc init claude           Claude Code only');
  console.log('    npx sdlc init copilot          GitHub Copilot only');
  console.log('    npx sdlc init codex            OpenAI Codex only');
  console.log('    npx sdlc init all              All platforms');
  console.log('\n  Update options:');
  console.log('    npx sdlc -u                   Regenerate all detected platforms');
  console.log('    npx sdlc -u claude            Regenerate Claude Code only');
  console.log('    npx sdlc -u copilot           Regenerate GitHub Copilot only');
  console.log('    npx sdlc -u codex             Regenerate OpenAI Codex only');
  console.log('    npx sdlc -u all               Regenerate all platforms\n');
}

// Handle -u / --update flag
const updateIdx = process.argv.includes('-u')
  ? process.argv.indexOf('-u')
  : process.argv.indexOf('--update');

if (updateIdx !== -1) {
  const nextArg = process.argv[updateIdx + 1];
  if (nextArg && !nextArg.startsWith('-')) {
    process.env.SDLC_UPDATE_PLATFORM = nextArg;
  }
  process.env.SDLC_COMMAND = 'update';
  process.env.SDLC_PACKAGE_DIR = path.resolve(__dirname, '..');
  process.argv = [process.argv[0], path.resolve(__dirname, '..', 'setup.js')];
  require('../setup.js');
} else if (command === 'help' || command === '--help' || command === '-h') {
  showHelp();
  process.exit(0);
} else {
  // Default to init when no command or platform name given directly
  const effectiveCommand = !command || COMMANDS[command] ? (command || 'init') : 'init';
  const effectiveArgs = !command || COMMANDS[command] ? args : [command, ...args];

  process.env.SDLC_COMMAND = effectiveCommand;
  process.env.SDLC_PACKAGE_DIR = path.resolve(__dirname, '..');
  process.argv = [process.argv[0], path.resolve(__dirname, '..', 'setup.js'), ...effectiveArgs];

  require('../setup.js');
}
