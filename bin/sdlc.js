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
  console.log('    npx sdlc init all              All platforms\n');
}

if (command === 'help' || command === '--help' || command === '-h') {
  showHelp();
  process.exit(0);
}

// Default to init when no command or platform name given directly
const effectiveCommand = !command || COMMANDS[command] ? (command || 'init') : 'init';
const effectiveArgs = !command || COMMANDS[command] ? args : [command, ...args];

// Delegate to setup.js
process.env.SDLC_COMMAND = effectiveCommand;
process.env.SDLC_PACKAGE_DIR = path.resolve(__dirname, '..');
process.argv = [process.argv[0], path.resolve(__dirname, '..', 'setup.js'), ...effectiveArgs];

require('../setup.js');
