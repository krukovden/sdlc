// Testing/helpers/cli-runner.js
//
// Unified CLI runner for tier-2 end-to-end SDLC workflow tests.
//
// Two execution modes:
// 1. Headless — single-shot, auto-approve, synchronous (runClaude, runCopilot, runCodex)
// 2. Interactive — long-running, phase-gate approval via stdin (spawnCLI + sendInput)
//
// Supported tools: claude, copilot, codex
//
// Environment variable overrides:
//   SDLC_CLAUDE_BIN   — Claude Code binary   (default: "claude")
//   SDLC_COPILOT_BIN  — GitHub Copilot CLI    (default: "gh copilot" proxy)
//   SDLC_CODEX_BIN    — OpenAI Codex binary   (default: "codex")

const { spawn, execSync, execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const LOGS_DIR = path.join(__dirname, '..', 'logs');

function ensureLogsDir() {
  if (!fs.existsSync(LOGS_DIR)) fs.mkdirSync(LOGS_DIR, { recursive: true });
}

// ---------------------------------------------------------------------------
// Tool CLI configurations
// ---------------------------------------------------------------------------

const TOOL_CONFIGS = {
  claude: {
    bin: process.env.SDLC_CLAUDE_BIN || 'claude',
    // Interactive: --pipe gives line-based stdin/stdout (no TUI)
    spawnArgs: ['--dangerously-skip-permissions', '--pipe'],
  },
  copilot: {
    // gh copilot is a thin proxy — actual binary is invoked as `gh copilot -- <args>`
    bin: process.env.SDLC_COPILOT_BIN || 'gh',
    // Interactive: -i starts interactive mode with initial prompt
    spawnArgs: ['copilot', '--', '--allow-all'],
  },
  codex: {
    bin: process.env.SDLC_CODEX_BIN || 'codex',
    // Interactive: codex in conversational mode
    spawnArgs: [],
  },
};

/**
 * Verify that a tool's CLI is available and authenticated.
 * Throws a descriptive error if not.
 *
 * @param {'claude'|'copilot'|'codex'} tool
 */
function verifyToolAvailable(tool) {
  try {
    switch (tool) {
      case 'copilot': {
        // Check gh auth first—Copilot silently fails without it
        execSync('gh auth status', { stdio: 'pipe', encoding: 'utf8' });
        // Then check the copilot extension is installed
        execSync('gh copilot -- --version', { stdio: 'pipe', encoding: 'utf8' });
        break;
      }
      case 'claude': {
        execSync('claude --version', { stdio: 'pipe', encoding: 'utf8' });
        break;
      }
      case 'codex': {
        execSync('codex --version', { stdio: 'pipe', encoding: 'utf8' });
        break;
      }
    }
  } catch (err) {
    const hint = tool === 'copilot'
      ? 'Run `gh auth login` then `gh copilot -- login` to authenticate.'
      : `Ensure "${tool}" is installed and in PATH.`;
    throw new Error(`[cli-runner] ${tool} CLI not available or not authenticated. ${hint}\n${err.message}`);
  }
}

/**
 * Build the prompt for a given workflow command.
 * Extracts the workflow type and description, then constructs
 * an explicit prompt that tells the AI to follow the SDLC skill
 * with --auto-approve.
 *
 * @param {string} command  - e.g. '/sdlc feature "add POST /echo endpoint"'
 * @param {object} [options]
 * @param {string} [options.stopAt] - Phase to stop after (e.g. 'design')
 * @returns {string} Full prompt
 */
function buildPrompt(command, { stopAt } = {}) {
  // Parse: /sdlc <type> "<description>"
  const match = command.match(/^[/$]sdlc\s+(\w+)\s+(.+)$/);
  if (!match) return command;

  const type = match[1];
  const description = match[2].replace(/^["']|["']$/g, '');

  const ALL_PHASES = ['clarify', 'research', 'design', 'plan', 'implement'];
  const workflowPhases = type === 'spike'
    ? ['clarify', 'research', 'design']
    : ALL_PHASES;

  // Truncate phases if stopAt is set
  let phases = workflowPhases;
  if (stopAt) {
    const stopIdx = ALL_PHASES.indexOf(stopAt);
    if (stopIdx !== -1) {
      phases = workflowPhases.filter(p => ALL_PHASES.indexOf(p) <= stopIdx);
    }
  }

  const phaseList = phases.join(', ');
  const hasImplement = phases.includes('implement');

  const lines = [
    `Execute /sdlc ${type} --auto-approve "${description}"`,
    '',
    'You MUST use the Write tool to create files. Do NOT just output text.',
    '',
    'Steps:',
    `1. Read .agents/skills/sdlc/SKILL.md and .agents/workflows/${type}.md`,
    `2. Create folder docs/workflows/${type}/ with a date-slug subfolder`,
    '3. Write manifest.json with all phases',
    `4. Execute each phase in order: ${phaseList}`,
    '5. For each phase, read .agents/skills/sdlc-{phase}/SKILL.md and produce its artifacts using the Write tool',
    '6. Update manifest.json status to "approved" after each phase',
  ];

  if (hasImplement) {
    lines.push('7. For implement: write code changes and produce 04-implementation-log.md');
  }

  if (stopAt && stopAt !== phases[phases.length - 1]) {
    // stopAt is before the natural end — add explicit stop instruction
  } else if (stopAt) {
    lines.push('', `STOP after completing the "${stopAt}" phase. Do NOT proceed to subsequent phases.`);
  }

  lines.push('', '--auto-approve: skip all confirmations, use current branch, no dashboard, no worktree.');

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Interactive prompt builder
// ---------------------------------------------------------------------------

/**
 * Parse an SDLC command string.
 * Handles: /sdlc feature "desc", /sdlc:resume, $sdlc bugfix "desc"
 */
function parseCommand(command) {
  const match = command.match(/^[/$]sdlc(?::(\w+))?\s*(?:(\w+)\s+)?(.*)$/);
  if (!match) return null;
  return {
    sub: match[1] || null,
    type: match[2] || null,
    description: (match[3] || '').replace(/^["']|["']$/g, '').trim(),
  };
}

/**
 * Build a prompt for interactive (gate-based) execution.
 * The AI is told to STOP at each phase gate and wait for "approve" from stdin.
 */
function buildInteractivePrompt(command) {
  const parsed = parseCommand(command);
  if (!parsed) return command;
  const { sub, type, description } = parsed;

  if (sub === 'resume') {
    return [
      'Resume the active SDLC workflow.',
      '',
      '1. Read the most recent manifest.json from docs/workflows/',
      '2. Resume from manifest.current_phase',
      '3. For each remaining phase: read the skill, produce artifacts, update manifest.json',
      '4. STOP after each phase and ask me to type "approve" before continuing',
      '5. Do NOT skip gates — wait for my explicit approval each time',
    ].join('\n');
  }

  const phases = type === 'spike'
    ? 'clarify, research, design'
    : 'clarify, research, design, plan, implement';

  return [
    `Execute an SDLC ${type} workflow: "${description}"`,
    '',
    'You MUST use the Write tool to create files. Do NOT just output text.',
    '',
    'Steps:',
    `1. Read .agents/skills/sdlc/SKILL.md and .agents/workflows/${type}.md`,
    `2. Create docs/workflows/${type}/ with a date-slug subfolder`,
    '3. Write manifest.json with all phases (each status: "pending")',
    `4. Execute phases in order: ${phases}`,
    '5. For each phase:',
    '   a. Update manifest.json: set phase status to "in_progress"',
    '   b. Read .agents/skills/sdlc-{phase}/SKILL.md',
    '   c. Produce the phase artifacts (write files)',
    '   d. Update manifest.json: set phase status to "awaiting_approval"',
    '   e. STOP and ask me to type "approve" before continuing',
    '6. When I type "approve", set phase status to "approved" and proceed',
    type !== 'spike' ? '7. For implement: dispatch sub-agents, write code, produce 04-implementation-log.md' : '',
    '',
    'IMPORTANT: Do NOT auto-approve. Wait for my explicit "approve" at each gate.',
  ].filter(Boolean).join('\n');
}

// ---------------------------------------------------------------------------
// Headless runners (synchronous, auto-approve)
// ---------------------------------------------------------------------------

/**
 * Run a Copilot workflow in headless mode.
 *
 * Executes `gh copilot -- -p "prompt" --allow-all` in non-interactive mode.
 * All stdout/stderr is captured to a log file.
 *
 * @param {string} command  - The /sdlc command (e.g. '/sdlc feature "..."')
 * @param {string} cwd      - Working directory (the test project)
 * @param {object} [options]
 * @param {number} [options.timeout=600000] - Timeout in ms (default 10 min)
 * @returns {{ exitCode: number, logFile: string, stdout: string, stderr: string }}
 */
function runCopilot(command, cwd, { stopAt, timeout = 600000 } = {}) {
  ensureLogsDir();
  verifyToolAvailable('copilot');

  const prompt = buildPrompt(command, { stopAt });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const logFile = path.join(LOGS_DIR, `copilot-${timestamp}.log`);
  const bin = TOOL_CONFIGS.copilot.bin;

  let stdout = '';
  let stderr = '';
  let exitCode = 0;

  try {
    stdout = execFileSync(
      bin,
      [
        'copilot', '--',
        '-p', prompt,
        '--allow-all',
        '--no-auto-update',
        '-s',
      ],
      {
        cwd,
        timeout,
        env: { ...process.env, NO_COLOR: '1' },
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
      }
    );
  } catch (err) {
    exitCode = err.status || 1;
    stdout = err.stdout || '';
    stderr = err.stderr || '';
  }

  fs.writeFileSync(logFile, [
    '=== Copilot CLI Run ===',
    `Command: ${command}`,
    `CWD: ${cwd}`,
    `Exit code: ${exitCode}`,
    `Timeout: ${timeout}ms`,
    '',
    '=== PROMPT ===',
    prompt,
    '',
    '=== STDOUT ===',
    stdout,
    '',
    '=== STDERR ===',
    stderr,
  ].join('\n'), 'utf8');

  return { exitCode, logFile, stdout, stderr };
}

/**
 * Run a Codex workflow in headless mode.
 *
 * Executes `codex exec` and waits for completion. All stdout/stderr is captured
 * to a log file so failures can still be inspected when artifacts are present.
 *
 * @param {string} command  - The $sdlc command (e.g. '$sdlc feature "..."')
 * @param {string} cwd      - Working directory (the test project)
 * @param {object} [options]
 * @param {number} [options.timeout=600000] - Timeout in ms (default 10 min)
 * @returns {{ exitCode: number, logFile: string, stdout: string, stderr: string }}
 */
function runCodex(command, cwd, { stopAt, timeout = 600000 } = {}) {
  ensureLogsDir();

  const prompt = buildPrompt(command, { stopAt });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const logFile = path.join(LOGS_DIR, `codex-${timestamp}.log`);

  let stdout = '';
  let stderr = '';
  let exitCode = 0;

  try {
    stdout = execFileSync(
      'codex',
      [
        'exec',
        '--skip-git-repo-check',
        '--sandbox',
        'workspace-write',
        '--ask-for-approval',
        'never',
        '--cd',
        cwd,
        prompt,
      ],
      {
        cwd,
        timeout,
        env: { ...process.env },
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
      }
    );
  } catch (err) {
    exitCode = err.status || 1;
    stdout = err.stdout || '';
    stderr = err.stderr || '';
  }

  fs.writeFileSync(logFile, [
    '=== Codex CLI Run ===',
    `Command: ${command}`,
    `CWD: ${cwd}`,
    `Exit code: ${exitCode}`,
    `Timeout: ${timeout}ms`,
    '',
    '=== PROMPT ===',
    prompt,
    '',
    '=== STDOUT ===',
    stdout,
    '',
    '=== STDERR ===',
    stderr,
  ].join('\n'), 'utf8');

  return { exitCode, logFile, stdout, stderr };
}

/**
 * Run a Claude Code workflow in headless mode.
 *
 * Executes `claude -p "prompt" --no-browser` and waits for completion.
 * All stdout/stderr is captured to a log file.
 *
 * @param {string} command  - The /sdlc command (e.g. '/sdlc feature "..."')
 * @param {string} cwd      - Working directory (the test project)
 * @param {object} [options]
 * @param {number} [options.timeout=600000] - Timeout in ms (default 10 min)
 * @returns {{ exitCode: number, logFile: string, stdout: string, stderr: string }}
 */
function runClaude(command, cwd, { stopAt, timeout = 600000 } = {}) {
  ensureLogsDir();

  const prompt = buildPrompt(command, { stopAt });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const logFile = path.join(LOGS_DIR, `claude-${timestamp}.log`);

  // Escape the prompt for shell
  const escapedPrompt = prompt.replace(/"/g, '\\"');

  let stdout = '';
  let stderr = '';
  let exitCode = 0;

  try {
    stdout = execSync(
      `claude -p "${escapedPrompt}" --dangerously-skip-permissions`,
      {
        cwd,
        timeout,
        env: { ...process.env },
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
      }
    );
  } catch (err) {
    exitCode = err.status || 1;
    stdout = err.stdout || '';
    stderr = err.stderr || '';
  }

  // Write log
  fs.writeFileSync(logFile, [
    `=== Claude CLI Run ===`,
    `Command: ${command}`,
    `CWD: ${cwd}`,
    `Exit code: ${exitCode}`,
    `Timeout: ${timeout}ms`,
    ``,
    `=== PROMPT ===`,
    prompt,
    ``,
    `=== STDOUT ===`,
    stdout,
    ``,
    `=== STDERR ===`,
    stderr,
  ].join('\n'), 'utf8');

  return { exitCode, logFile, stdout, stderr };
}

/**
 * Find and parse the most recent manifest.json in docs/workflows/.
 */
function getManifest(cwd) {
  const workflowsDir = path.join(cwd, 'docs', 'workflows');
  if (!fs.existsSync(workflowsDir)) return null;

  let latest = null;
  let latestTime = 0;

  const scan = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scan(full);
      } else if (entry.name === 'manifest.json') {
        const stat = fs.statSync(full);
        if (stat.mtimeMs > latestTime) {
          latestTime = stat.mtimeMs;
          latest = full;
        }
      }
    }
  };
  scan(workflowsDir);

  if (!latest) return null;
  try {
    return JSON.parse(fs.readFileSync(latest, 'utf8'));
  } catch {
    return null;
  }
}

module.exports = {
  // Headless runners (synchronous, auto-approve)
  runClaude,
  runCopilot,
  runCodex,
  // Interactive runners (async, phase-gate approval)
  spawnCLI,
  sendInput,
  waitForPhase,
  killCLI,
  // Shared
  buildPrompt,
  getManifest,
  verifyToolAvailable,
  // Internals (exported for testing)
  TOOL_CONFIGS,
  buildInteractivePrompt,
  parseCommand,
};

// ---------------------------------------------------------------------------
// Interactive runner — spawn CLI for phase-gate approval via stdin
// ---------------------------------------------------------------------------

/**
 * Spawn a CLI tool in interactive mode.
 * The initial SDLC prompt is sent to stdin. The process stays alive
 * so the test can poll manifest.json and send "approve" at each gate.
 *
 * @param {'claude'|'copilot'|'codex'} tool
 * @param {string} command  — e.g. '/sdlc feature "add POST /echo"'
 * @param {string} cwd      — working directory (test project)
 * @returns {{ child: ChildProcess, tool: string, cwd: string, logFile: string }}
 */
function spawnCLI(tool, command, cwd) {
  const config = TOOL_CONFIGS[tool];
  if (!config) {
    throw new Error(`Unknown tool: "${tool}". Supported: claude, copilot, codex`);
  }

  verifyToolAvailable(tool);
  ensureLogsDir();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const logFile = path.join(LOGS_DIR, `${tool}-interactive-${timestamp}.log`);
  const prompt = buildInteractivePrompt(command);

  // Write log header
  fs.writeFileSync(logFile, [
    `=== ${tool} Interactive Run ===`,
    `Command: ${command}`,
    `CWD: ${cwd}`,
    `Started: ${new Date().toISOString()}`,
    '',
    '=== PROMPT ===',
    prompt,
    '',
    '=== OUTPUT ===',
    '',
  ].join('\n'), 'utf8');

  const child = spawn(config.bin, config.spawnArgs, {
    cwd,
    stdio: ['pipe', 'pipe', 'pipe'],
    env: {
      ...process.env,
      TERM: 'dumb',
      NO_COLOR: '1',
    },
  });

  // Stream output to log file
  child.stdout.on('data', (data) => {
    fs.appendFileSync(logFile, data);
  });
  child.stderr.on('data', (data) => {
    fs.appendFileSync(logFile, `[stderr] ${data}`);
  });

  // Send the initial prompt
  child.stdin.write(prompt + '\n');

  return { child, tool, cwd, logFile };
}

/**
 * Send text input (e.g. "approve") to an interactive CLI handle.
 *
 * @param {{ child: ChildProcess, logFile: string }} handle
 * @param {string} text — text to send (newline appended automatically)
 */
function sendInput(handle, text) {
  if (handle.child.stdin && handle.child.stdin.writable) {
    handle.child.stdin.write(text + '\n');
    fs.appendFileSync(handle.logFile, `\n[input] ${text}\n`);
  }
}

/**
 * Poll manifest.json until the given phase transitions out of "pending".
 * Returns the manifest object, or rejects on timeout.
 *
 * @param {string} cwd     — test project directory
 * @param {string} phase   — phase name: clarify, research, design, plan, implement
 * @param {number} [timeout=300000] — max wait in ms (default 5 min)
 * @returns {Promise<object>} manifest
 */
async function waitForPhase(cwd, phase, timeout = 300000) {
  const POLL_MS = 2000;
  const start = Date.now();

  while (Date.now() - start < timeout) {
    const manifest = getManifest(cwd);
    if (manifest?.phases?.[phase]) {
      const data = manifest.phases[phase];
      const status = typeof data === 'string' ? data : data?.status;
      // Phase has started (no longer "pending")
      if (status && status !== 'pending') {
        return manifest;
      }
    }
    await new Promise(resolve => setTimeout(resolve, POLL_MS));
  }

  throw new Error(
    `Timed out after ${timeout}ms waiting for phase "${phase}" to leave "pending" state`
  );
}

/**
 * Gracefully kill a CLI process. Closes stdin, sends SIGTERM, then
 * SIGKILL after 5 seconds if still alive.
 *
 * @param {{ child: ChildProcess, logFile: string }} handle
 * @returns {Promise<void>}
 */
async function killCLI(handle) {
  return new Promise((resolve) => {
    if (!handle?.child || handle.child.exitCode !== null) {
      return resolve();
    }

    const forceKillTimer = setTimeout(() => {
      if (handle.child.exitCode === null) {
        handle.child.kill('SIGKILL');
      }
    }, 5000);

    handle.child.once('exit', () => {
      clearTimeout(forceKillTimer);
      fs.appendFileSync(handle.logFile,
        `\n[runner] Process exited (code: ${handle.child.exitCode})\n`);
      resolve();
    });

    // Close stdin, then terminate
    if (handle.child.stdin && handle.child.stdin.writable) {
      handle.child.stdin.end();
    }
    handle.child.kill('SIGTERM');
  });
}
