// Testing/helpers/cli-runner.js
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const LOGS_DIR = path.join(__dirname, '..', 'logs');

const TOOL_CONFIGS = {
  claude:  { cmd: 'claude', args: ['--no-browser'] },
  copilot: { cmd: 'gh', args: ['copilot'] },
  codex:   { cmd: 'codex', args: [] },
};

function ensureLogsDir() {
  if (!fs.existsSync(LOGS_DIR)) fs.mkdirSync(LOGS_DIR, { recursive: true });
}

function spawnCLI(tool, command, cwd) {
  ensureLogsDir();
  const config = TOOL_CONFIGS[tool];
  if (!config) throw new Error(`Unknown tool: ${tool}`);

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const logFile = path.join(LOGS_DIR, `${tool}-${timestamp}.log`);
  const logStream = fs.createWriteStream(logFile, { flags: 'a' });

  const proc = spawn(config.cmd, [...config.args], {
    cwd, stdio: ['pipe', 'pipe', 'pipe'], env: { ...process.env }, shell: true,
  });

  proc.stdout.on('data', (data) => logStream.write(`[stdout] ${data}`));
  proc.stderr.on('data', (data) => logStream.write(`[stderr] ${data}`));

  if (command) proc.stdin.write(command + '\n');

  return { proc, logFile, stdin: proc.stdin, stdout: proc.stdout, stderr: proc.stderr };
}

function sendInput(handle, text) { handle.stdin.write(text + '\n'); }

function waitForPhase(cwd, phase, timeout = 300000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const interval = setInterval(() => {
      if (Date.now() - start > timeout) { clearInterval(interval); reject(new Error(`Timeout waiting for phase "${phase}"`)); return; }
      const manifest = getManifest(cwd);
      if (manifest && manifest.phases && manifest.phases[phase]?.status === 'approved') { clearInterval(interval); resolve(manifest); }
    }, 3000);
  });
}

function waitForArtifact(cwd, relativePath, timeout = 120000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const interval = setInterval(() => {
      if (Date.now() - start > timeout) { clearInterval(interval); reject(new Error(`Timeout waiting for artifact "${relativePath}"`)); return; }
      const full = path.join(cwd, relativePath);
      if (fs.existsSync(full)) { clearInterval(interval); resolve(full); }
    }, 2000);
  });
}

function getManifest(cwd) {
  const workflowsDir = path.join(cwd, 'docs', 'workflows');
  if (!fs.existsSync(workflowsDir)) return null;
  let latest = null; let latestTime = 0;
  const scan = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) scan(full);
      else if (entry.name === 'manifest.json') {
        const stat = fs.statSync(full);
        if (stat.mtimeMs > latestTime) { latestTime = stat.mtimeMs; latest = full; }
      }
    }
  };
  scan(workflowsDir);
  if (!latest) return null;
  try { return JSON.parse(fs.readFileSync(latest, 'utf8')); } catch { return null; }
}

function killCLI(handle) {
  return new Promise((resolve) => {
    if (handle.proc.exitCode !== null) { resolve(); return; }
    handle.proc.on('exit', resolve);
    handle.proc.kill('SIGTERM');
    setTimeout(() => { if (handle.proc.exitCode === null) handle.proc.kill('SIGKILL'); }, 5000);
  });
}

module.exports = { spawnCLI, sendInput, waitForPhase, waitForArtifact, getManifest, killCLI };
