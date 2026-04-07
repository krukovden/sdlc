// Testing/helpers/cli-runner.js
//
// Runs AI CLI tools in headless mode (non-interactive).
// Claude Code: claude -p "prompt" --no-browser
//
// The prompt includes an auto-approve instruction so the workflow
// runs all phases without stopping at gates.

const { execSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const LOGS_DIR = path.join(__dirname, '..', 'logs');

function ensureLogsDir() {
  if (!fs.existsSync(LOGS_DIR)) fs.mkdirSync(LOGS_DIR, { recursive: true });
}

/**
 * Build the prompt for a given workflow command.
 * Injects --auto-approve into the /sdlc command so the workflow
 * skills skip all interactive gates.
 *
 * @param {string} command  - e.g. '/sdlc feature "add POST /echo endpoint"'
 * @returns {string} Full prompt with auto-approve flag
 */
function buildPrompt(command) {
  // Inject --auto-approve after the workflow type
  // e.g. '/sdlc feature "..."' → '/sdlc feature --auto-approve "..."'
  const autoCmd = command.replace(
    /^(\/sdlc\s+\w+)\s+/,
    '$1 --auto-approve '
  );

  return `Run: ${autoCmd}`;
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
function runClaude(command, cwd, { timeout = 600000 } = {}) {
  ensureLogsDir();

  const prompt = buildPrompt(command);
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

module.exports = { runClaude, buildPrompt, getManifest };
