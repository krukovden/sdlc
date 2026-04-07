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
 * Extracts the workflow type and description, then constructs
 * an explicit prompt that tells Claude to follow the SDLC skill
 * with --auto-approve.
 *
 * @param {string} command  - e.g. '/sdlc feature "add POST /echo endpoint"'
 * @returns {string} Full prompt
 */
function buildPrompt(command) {
  // Parse: /sdlc <type> "<description>"
  const match = command.match(/^\/sdlc\s+(\w+)\s+(.+)$/);
  if (!match) return command;

  const type = match[1];
  const description = match[2].replace(/^["']|["']$/g, '');

  return [
    `You are running an SDLC ${type} workflow with --auto-approve mode.`,
    '',
    `Task: ${description}`,
    '',
    'Follow these instructions exactly:',
    '',
    '1. Read the SDLC workflow skill from .agents/skills/sdlc/SKILL.md',
    `2. Read the ${type} workflow definition from .agents/workflows/${type}.md`,
    '3. --auto-approve is active: skip ALL interactive gates (type confirmation, git isolation, dashboard, phase approvals)',
    '4. Use current branch, no dashboard, no worktree',
    `5. Create the workflow folder: docs/workflows/${type}/{date}-{slug}/`,
    '6. Create manifest.json with all phases',
    `7. Execute ALL phases sequentially: ${type === 'spike' ? 'clarify → research → design → DONE' : 'clarify → research → design → plan → implement'}`,
    '8. For each phase, read the phase skill from .agents/skills/sdlc-{phase}/SKILL.md',
    '9. Produce ALL artifacts defined in the workflow definition',
    '10. Update manifest.json status to "approved" after each phase',
    type !== 'spike' ? '11. For implementation: follow the agent pipeline (Coder → Tester → Reviewer → Security → Lead compliance)' : '',
    '',
    'Do NOT ask questions. Do NOT stop. Run the entire workflow to completion.',
  ].filter(Boolean).join('\n');
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
