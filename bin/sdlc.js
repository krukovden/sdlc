#!/usr/bin/env node

const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');

const command = process.argv[2];
const args = process.argv.slice(3);

const COMMANDS = {
  init:      'Initialize SDLC system in current project',
  uninstall: 'Remove all SDLC-generated files from current project',
  server:    'Manage the SDLC manifest tracking server',
  help:      'Show this help message',
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
  console.log('    npx sdlc -u all               Regenerate all platforms');
  console.log('\n  Uninstall options:');
  console.log('    npx sdlc uninstall            Remove all SDLC-generated files');
  console.log('    npx sdlc --uninstall          Same (long flag form)');
  console.log('    npx sdlc -x                   Same (short flag form)');
  console.log('\n  Server options:');
  console.log('    npx sdlc server               Start server (alias for start)');
  console.log('    npx sdlc server start         Ensure running, print URL');
  console.log('    npx sdlc server stop          Stop the server');
  console.log('    npx sdlc server status        Show PID, port, uptime');
  console.log('    npx sdlc server url           Print just the URL\n');
}

function serverJson() {
  const p = path.join(process.cwd(), '\.sdlc/server.json');
  if (!fs.existsSync(p)) return null;
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; }
}

function handleServer(sub) {
  const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
  const startPy = path.join(path.resolve(__dirname, '..'), '.sdlc', 'assets', 'server', 'start.py');
  const action = sub || 'start';

  if (action === 'start') {
    const result = spawnSync(pythonCmd, [startPy], {
      cwd: process.cwd(), stdio: 'inherit',
    });
    if (result.error) {
      console.error(`  ✗ Failed to start server: ${result.error.message}`);
      process.exit(1);
    }
    process.exit(result.status ?? 1);
  }

  if (action === 'url') {
    const data = serverJson();
    if (!data) {
      console.error('  ✗ Server not running. Run: npx sdlc server start');
      process.exit(1);
    }
    console.log(data.url);
    process.exit(0);
  }

  if (action === 'status') {
    const data = serverJson();
    if (!data) {
      console.log('  Server not running.');
      process.exit(0);
    }
    const upSec = Math.floor((Date.now() - new Date(data.started)) / 1000);
    console.log(`  PID:     ${data.pid}`);
    console.log(`  Port:    ${data.port}`);
    console.log(`  URL:     ${data.url}`);
    console.log(`  Uptime:  ${upSec}s`);
    process.exit(0);
  }

  if (action === 'stop') {
    const http = require('http');
    const data = serverJson();
    if (!data) {
      console.log('  Server not running.');
      process.exit(0);
    }
    const req = http.request(
      { hostname: 'localhost', port: data.port, path: '/stop', method: 'POST' },
      () => {
        try { fs.unlinkSync(path.join(process.cwd(), '\.sdlc/server.json')); } catch {}
        console.log('  Server stopped.');
        process.exit(0);
      },
    );
    req.on('error', () => {
      try { fs.unlinkSync(path.join(process.cwd(), '\.sdlc/server.json')); } catch {}
      console.log('  Server stopped (was not responding).');
      process.exit(0);
    });
    req.end();
    return;
  }

  console.error(`  ✗ Unknown server action: ${action}`);
  process.exit(1);
}

// Handle -x / --uninstall flag (must be checked BEFORE -u/--update)
const uninstallIdx = process.argv.includes('-x')
  ? process.argv.indexOf('-x')
  : process.argv.indexOf('--uninstall');

if (uninstallIdx !== -1) {
  process.env.SDLC_COMMAND = 'uninstall';
  process.env.SDLC_PACKAGE_DIR = path.resolve(__dirname, '..');
  process.argv = [process.argv[0], path.resolve(__dirname, '..', 'setup.js')];
  require('../setup.js');
} else if (process.argv.includes('-u') || process.argv.includes('--update')) {
  const updateIdx = process.argv.includes('-u')
    ? process.argv.indexOf('-u')
    : process.argv.indexOf('--update');
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
} else if (command === 'server') {
  handleServer(args[0]);
} else {
  // Default to init when no command or platform name given directly
  const effectiveCommand = !command || COMMANDS[command] ? (command || 'init') : 'init';
  const effectiveArgs = !command || COMMANDS[command] ? args : [command, ...args];

  process.env.SDLC_COMMAND = effectiveCommand;
  process.env.SDLC_PACKAGE_DIR = path.resolve(__dirname, '..');
  process.argv = [process.argv[0], path.resolve(__dirname, '..', 'setup.js'), ...effectiveArgs];

  require('../setup.js');
}
