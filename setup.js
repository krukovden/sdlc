#!/usr/bin/env node

/**
 * SDLC System Setup
 *
 * Reads .sdlc/ (source of truth) from the PACKAGE and generates
 * platform-specific adapter files in the USER'S PROJECT.
 *
 * When run as npm package (via bin/sdlc.js):
 *   PACKAGE_DIR = node_modules/sdlc/    (contains .sdlc/)
 *   PROJECT_DIR = process.cwd()         (user's project)
 *
 * When run directly in the sdlc repo:
 *   PACKAGE_DIR = PROJECT_DIR = __dirname
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const PACKAGE_DIR = process.env.SDLC_PACKAGE_DIR || __dirname;
const PROJECT_DIR = process.cwd();
const AGENTS_SRC = path.join(PACKAGE_DIR, '.sdlc');
const COMMAND = process.env.SDLC_COMMAND || 'init';
const MANIFEST_REL = '.sdlc/manifest.json';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function writeIfChanged(filePath, content) {
  ensureDir(path.dirname(filePath));
  const existing = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : null;
  if (existing === content) return 'unchanged';
  fs.writeFileSync(filePath, content, 'utf8');
  return existing === null ? 'created' : 'updated';
}

function listDirs(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);
}

function listFiles(dir, ext) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.endsWith(ext));
}

function listFilesRecursive(dir, baseDir) {
  const result = [];
  if (!fs.existsSync(dir)) return result;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      result.push(...listFilesRecursive(fullPath, baseDir));
    } else {
      result.push(path.relative(baseDir, fullPath).split(path.sep).join('/'));
    }
  }
  return result;
}

function readFile(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n/);
  if (!match) return { meta: {}, body: content };
  const meta = {};
  match[1].split('\n').forEach(line => {
    const m = line.match(/^(\w+):\s*"?(.+?)"?\s*$/);
    if (m) meta[m[1]] = m[2];
  });
  return { meta, body: content.slice(match[0].length) };
}

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function detectInstalledPlugins() {
  const home = process.env.HOME || process.env.USERPROFILE;
  const registryPath = path.join(home, '.claude', 'plugins', 'installed_plugins.json');
  if (!fs.existsSync(registryPath)) return [];
  try {
    const data = JSON.parse(readFile(registryPath));
    return Object.keys(data.plugins || {}).map(key => key.split('@')[0]);
  } catch { return []; }
}

function copyDirRecursive(src, dest) {
  ensureDir(dest);
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      const content = readFile(srcPath);
      writeIfChanged(destPath, content);
    }
  }
}

// ---------------------------------------------------------------------------
// Discover .sdlc/ content (from PACKAGE)
// ---------------------------------------------------------------------------

function discoverAgents() {
  const dir = path.join(AGENTS_SRC, 'agents');
  return listFiles(dir, '.md').map(f => {
    const name = f.replace('.md', '');
    const content = readFile(path.join(dir, f));
    return { name, content };
  });
}

function discoverSkills(agentsDir = AGENTS_SRC) {
  const dir = path.join(agentsDir, 'skills');
  return listDirs(dir).map(name => {
    const skillFile = path.join(dir, name, 'SKILL.md');
    if (!fs.existsSync(skillFile)) return null;
    const content = readFile(skillFile);
    const { meta } = parseFrontmatter(content);
    return { name, content, meta };
  }).filter(Boolean);
}

// ---------------------------------------------------------------------------
// Agent metadata — descriptions for platform wrappers
// ---------------------------------------------------------------------------

const AGENT_META = {
  'sdlc-lead': {
    description: 'SDLC orchestrator — drives workflow phases, dispatches agents (Coder, Tester, Reviewer, Security), performs design compliance checks, manages stop-gates and manifests. Use for any /sdlc workflow.',
    guidelines: ['conventions.md', 'principles.md'],
    extra: 'Read the workflow definition from `.sdlc/workflows/` matching the current workflow type.\n\nYou are the Lead agent. You orchestrate, dispatch, and verify. You do NOT write code.',
    copilotExtra: 'You are the Lead agent. You orchestrate the SDLC workflow phases (clarify → research → design → plan → implement).\nFor implementation, coordinate work sequentially: use @sdlc-coder for code, @sdlc-tester for tests, @sdlc-reviewer for review, @sdlc-security for security analysis.',
    codexExtra: 'You are the Lead agent. You orchestrate the SDLC workflow phases (clarify → research → design → plan → implement).\nFor implementation, spawn subagents: sdlc-coder for code, sdlc-tester for tests, sdlc-reviewer for review, sdlc-security for security analysis.',
    codexReasoning: 'high',
  },
  'sdlc-coder': {
    description: 'SDLC implementation agent — writes code based on design artifacts and task specs. In autonomous mode, spawns Tester to continue the pipeline. Does not write tests, review code, or make architectural decisions.',
    guidelines: ['conventions.md', 'principles.md'],
    extra: 'Your task will be provided by the Lead agent or another agent in the pipeline. Focus only on implementation.\nDo NOT write tests, review code, or make architectural decisions.\n\nIn autonomous pipeline mode (pipeline_mode: autonomous), after implementing, spawn the Tester agent as a subagent and pass the pipeline context forward.\nWhen spawned for a retry fix (retry_fix: true), just fix the issue and return — do NOT spawn Tester.',
  },
  'sdlc-tester': {
    description: 'SDLC testing agent — writes tests and verifies they pass. In autonomous mode, spawns Coder for retry fixes and Reviewer to continue the pipeline. Does not modify implementation code.',
    guidelines: ['testing.md', 'conventions.md'],
    extra: 'Your task will be provided by the Lead agent or the Coder agent (in autonomous mode). Focus only on writing and running tests.\nDo NOT modify implementation code.\n\nIn autonomous pipeline mode (pipeline_mode: autonomous), if tests fail spawn Coder for retry (max 3). Once tests pass, spawn the Reviewer agent as a subagent and pass the pipeline context forward.',
  },
  'sdlc-reviewer': {
    description: 'SDLC code review agent — reviews code quality, SOLID/KISS/YAGNI/DRY compliance, and domain-specific patterns. In autonomous mode, spawns Coder for retry fixes and Security to continue the pipeline. Read-only — produces verdict only, does not modify code.',
    guidelines: ['principles.md', 'conventions.md'],
    extra: 'Your task will be provided by the Lead agent or the Tester agent (in autonomous mode). Review code and produce a verdict.\nDo NOT modify any code. Output: PASS / NEEDS CHANGES / FAIL.\n\nIn autonomous pipeline mode (pipeline_mode: autonomous), if verdict is NEEDS CHANGES spawn Coder for retry (max 3). Once PASS, spawn the Security agent as a subagent and pass the pipeline context forward.',
  },
  'sdlc-security': {
    description: 'SDLC security analysis agent — checks for injection risks, auth/authz issues, secrets exposure, input validation gaps, and sensitive data logging. In autonomous mode, spawns Coder for retry fixes. Terminal node — returns completed pipeline context. Read-only — produces assessment only.',
    guidelines: ['error-handling.md', 'conventions.md'],
    extra: 'Your task will be provided by the Lead agent or the Reviewer agent (in autonomous mode). Analyze code for security issues.\nDo NOT modify any code. Output: PASS / SECURITY ISSUE.\n\nIn autonomous pipeline mode (pipeline_mode: autonomous), if assessment is SECURITY ISSUE spawn Coder for retry (max 3). Once PASS, return the completed pipeline context. You are the terminal node — do NOT spawn any further agents.',
  },
};

// ---------------------------------------------------------------------------
// Command definitions
// ---------------------------------------------------------------------------

const SLASH_COMMANDS = {
  'sdlc': {
    description: 'Start an SDLC workflow — clarify → research → design → plan → implement',
    claude: `Invoke the \`sdlc\` skill to run the full SDLC workflow pipeline.

$ARGUMENTS format: \`<type> [--auto-approve] <description>\` or just \`<description>\`

Supported types: \`feature\`, \`bugfix\`, \`refactor\`, \`spike\`

Options:
- \`--auto-approve\` — skip all interactive gates, run to completion without stopping

Examples:
- \`/sdlc feature "Add user notification preferences"\`
- \`/sdlc bugfix "Login returns 500 when no profile picture"\`
- \`/sdlc refactor "Extract payment logic into separate service"\`
- \`/sdlc spike "Evaluate auth library options"\`
- \`/sdlc "Investigate auth options"\` (type auto-detected)
- \`/sdlc feature --auto-approve "Add endpoint"\` (no stops)

If $ARGUMENTS is empty, ask the user what they want to work on.
If $ARGUMENTS is a file path, read that file as the task description/PRD.
`,
    copilot: `Start an SDLC workflow for: $ARGUMENTS

1. Read \`.sdlc/workflows/\` to understand workflow types (feature, bugfix, refactor, spike)
2. Detect the workflow type from the description
3. Confirm with the user
4. Follow the phase sequence defined in the matching workflow file
5. Use \`sdlc-doc/workflows/<type>/<date>-<name>/\` for all artifacts
6. Stop at each phase gate for user approval

Use @sdlc-lead to orchestrate the workflow.
`,
  },
  'sdlc-clarify': {
    description: 'Run the SDLC clarify phase — refine scope, constraints, success criteria',
    claude: `Invoke the \`sdlc\` skill with phase=clarify.

If $ARGUMENTS is provided, use it as the task context.
Otherwise, look for an active workflow in sdlc-doc/workflows/ (most recent manifest.json).
`,
    copilot: `Run the SDLC clarify phase for: $ARGUMENTS

1. Read the \`sdlc-clarify\` skill from \`.sdlc/skills/sdlc-clarify/SKILL.md\`
2. Follow its instructions to refine scope and constraints
3. Produce \`00-clarify.md\` in the workflow folder
4. Present findings for approval

Use @sdlc-lead to orchestrate.
`,
  },
  'sdlc-research': {
    description: 'Run the SDLC research phase — analyze codebase, patterns, domain',
    claude: `Invoke the \`sdlc\` skill with phase=research.

If $ARGUMENTS is provided, use it as the task context.
Otherwise, look for an active workflow in sdlc-doc/workflows/ (most recent manifest.json).
`,
    copilot: `Run the SDLC research phase for: $ARGUMENTS

1. Read the \`sdlc-research\` skill from \`.sdlc/skills/sdlc-research/SKILL.md\`
2. Follow its instructions to analyze the codebase
3. Produce \`01-research.md\` in the workflow folder
4. Present findings for approval

Use @sdlc-lead to orchestrate.
`,
  },
  'sdlc-design': {
    description: 'Run the SDLC design phase — architecture, API contracts, data model',
    claude: `Invoke the \`sdlc\` skill with phase=design.

If $ARGUMENTS is provided, use it as the task context.
Otherwise, look for an active workflow in sdlc-doc/workflows/ (most recent manifest.json).
`,
    copilot: `Run the SDLC design phase for: $ARGUMENTS

1. Read the \`sdlc-design\` skill from \`.sdlc/skills/sdlc-design/SKILL.md\`
2. Follow its instructions to produce design artifacts
3. Produce artifacts in \`02-design/\` in the workflow folder
4. Present findings for approval

Use @sdlc-lead to orchestrate.
`,
  },
  'sdlc-plan': {
    description: 'Run the SDLC plan phase — task breakdown with dependencies',
    claude: `Invoke the \`sdlc\` skill with phase=plan.

If $ARGUMENTS is provided, use it as the task context.
Otherwise, look for an active workflow in sdlc-doc/workflows/ (most recent manifest.json).
`,
    copilot: `Run the SDLC plan phase for: $ARGUMENTS

1. Read the \`sdlc-plan\` skill from \`.sdlc/skills/sdlc-plan/SKILL.md\`
2. Follow its instructions to create implementation plan
3. Produce \`03-plan.md\` in the workflow folder
4. Present plan for approval

Use @sdlc-lead to orchestrate.
`,
  },
  'sdlc-implement': {
    description: 'Run the SDLC implement phase — agents execute the plan',
    claude: `Invoke the \`sdlc\` skill with phase=implement.

If $ARGUMENTS is provided, use it as the task context.
Otherwise, look for an active workflow in sdlc-doc/workflows/ (most recent manifest.json).
`,
    copilot: `Run the SDLC implement phase for: $ARGUMENTS

1. Read the \`sdlc-implement\` skill from \`.sdlc/skills/sdlc-implement/SKILL.md\`
2. Follow its instructions to execute the implementation plan
3. Produce \`04-implementation-log.md\` in the workflow folder
4. Present results for approval

Use @sdlc-lead to orchestrate.
`,
  },
  'sdlc-resume': {
    description: 'Resume an SDLC workflow from where you left off',
    claude: `Invoke the \`sdlc\` skill with mode=resume.

$ARGUMENTS: optional phase name to resume from (e.g., \`design\`, \`plan\`).

Behavior:
1. Read manifest.json from the most recent workflow folder in sdlc-doc/workflows/
   (or user-specified path if $ARGUMENTS contains a path)
2. If $ARGUMENTS specifies a phase, resume from that phase
3. If no phase specified, resume from manifest's current_phase
4. Re-read all prior artifacts (they may have been manually edited)
5. If artifacts changed since producing phase, note at stop-gate
6. Restore worktree context if isolation=worktree

If no active workflow found, tell the user and suggest /sdlc to start a new one.
`,
    copilot: `Resume an SDLC workflow.

1. Read the most recent \`manifest.json\` from \`sdlc-doc/workflows/\`
2. If $ARGUMENTS specifies a phase, resume from that phase
3. Otherwise resume from \`manifest.current_phase\`
4. Re-read all prior artifacts
5. Continue the workflow

Use @sdlc-lead to orchestrate.
`,
  },
};

// ---------------------------------------------------------------------------
// Generator: Claude Code (.claude/)
// ---------------------------------------------------------------------------

function generateClaude(skills, installedPlugins) {
  const dir = path.join(PROJECT_DIR, '.claude');
  const results = { created: 0, updated: 0, unchanged: 0, files: [] };

  function write(filePath, content) {
    const status = writeIfChanged(filePath, content);
    results[status]++;
    results.files.push(path.relative(PROJECT_DIR, filePath).split(path.sep).join('/'));
  }

  const hasSuperpowers = installedPlugins.includes('superpowers');

  // CLAUDE.md — rich platform-specific config
  const skillTable = skills
    .filter(s => !s.name.startsWith('sdlc'))
    .map(s => `| ${s.meta.description?.split(' — ')[0] || s.name} | \`${s.name}\` |`)
    .join('\n');

  const claudeMd = `# MY DEVELOPMENT SYSTEM

## Source of Truth

All shared knowledge lives in \`.sdlc/\`:
- **Skills:** \`.sdlc/skills/\` (domain knowledge, SDLC phases)
- **Agent instructions:** \`.sdlc/agents/\` (role definitions)
- **Guidelines:** \`.sdlc/guidelines/\` (conventions, principles, error handling, testing)
- **Workflows:** \`.sdlc/workflows/\` (feature, bugfix, refactor, spike definitions)

Read and apply these guidelines for ALL work:
- \`.sdlc/guidelines/conventions.md\` — tech stack and file conventions
- \`.sdlc/guidelines/principles.md\` — SOLID, KISS, YAGNI, DRY
- \`.sdlc/guidelines/error-handling.md\` — error handling and scalability
- \`.sdlc/guidelines/testing.md\` — testing strategy and non-negotiables

## Architecture

### SDLC Workflow System
Three-layer design: Commands (entry points) → Skills (orchestration logic) → Agents (isolated execution).

### Domain Skills
These skills define technology-specific patterns and are consumed by agents.

**All on-demand** (triggered by description or commands when needed):

| Task type | Skill |
|-----------|-------|
${skillTable}

## Tech Stack
- Frontend: Angular 18+
- Backend: Node/TypeScript + C# Azure Functions
- CI/CD: GitHub Actions + Azure Pipelines

## Workflow (ALWAYS follow this)

### SDLC Workflows
Use \`/sdlc\` commands for all development work:

| Command | Purpose |
|---------|---------|
| \`/sdlc <type> <description>\` | Full pipeline — clarify → research → design → plan → implement |
| \`/sdlc:clarify\` | Clarify phase only |
| \`/sdlc:research\` | Research phase only |
| \`/sdlc:design\` | Design phase only |
| \`/sdlc:plan\` | Plan phase only |
| \`/sdlc:implement\` | Implement phase only |
| \`/sdlc:resume <phase>\` | Resume from specific phase |

Workflow types: \`feature\`, \`bugfix\`, \`refactor\`, \`spike\`

### Multi-Agent Team
Each implementation task is executed by isolated agents:
- **Lead** — orchestrates, makes architectural decisions, checks design compliance
- **Coder** — writes implementation code only
- **Tester** — writes and runs tests
- **Reviewer** — reviews code quality and principles
- **Security** — security analysis (Feature/Bugfix always, Refactor optional)

### External Plugin Integration
This system is fully self-contained. External plugins (e.g. \`superpowers\`) are optional enhancements, never dependencies.

**Merge rule**: When an external plugin skill overlaps with a built-in skill, **merge them** — combine best practices from both. The built-in skill is PRIMARY (its instructions win on any conflict). The external skill is SUPPLEMENTARY (its non-conflicting practices are adopted).

**Never choose one over the other** — always merge. The Lead agent performs skill resolution at dispatch time (see \`sdlc-lead.md\` for details).

## Principles (ALWAYS apply)

**SOLID** — Single responsibility, Open/closed, Liskov substitution, Interface segregation, Dependency inversion
**KISS** — Simplest solution that works; readable names; explicit over implicit
**YAGNI** — Build only what is required now; remove dead code immediately
**DRY** — Extract shared logic only at 3+ real duplications; duplication beats wrong abstraction

**Error handling** — Explicit at every boundary; typed errors; never swallow silently; log with correlation IDs
**Testing** — Unit > Integration > E2E; test edges and invariants, not just happy paths
**Scalability** — Stateless by default; async/non-blocking for I/O; no in-process caches across instances

## Non-Negotiables
- Never write code before a spec/plan is approved
- Every task gets exactly ONE role skill
- \`enhanced-reviewer\` runs before every commit
- Secrets never in source — always Key Vault / GitHub Secrets

## File Conventions
- TypeScript strict mode everywhere
- Angular: standalone components, signals for state
- Node: controllers → services → repositories pattern
- C#: thin Azure Functions, DI via constructor injection
- Pipelines: reusable templates, environment-specific variables
`;
  write(path.join(dir, 'CLAUDE.md'), claudeMd);

  // QUICKSTART.md
  const quickstart = `# Quick Start

Run \`/sdlc feature "description"\` to start a workflow.
Run \`/sdlc:resume\` to resume an existing workflow.

See README.md for full documentation.
`;
  write(path.join(dir, 'QUICKSTART.md'), quickstart);

  // settings.json
  const settings = {
    env: { CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS: '1' },
    plugins: hasSuperpowers ? ['superpowers'] : [],
    skills: {
      'always-active': [],
      foundation: hasSuperpowers ? [
        'superpowers:using-git-worktrees',
        'superpowers:systematic-debugging',
        'superpowers:test-driven-development',
        'superpowers:dispatching-parallel-agents',
      ] : [],
    },
    hooks: {
      Stop: [
        {
          hooks: [
            {
              type: 'command',
              command: process.platform === 'win32'
                ? 'powershell -c "if (Test-Path \'C:\\\\Windows\\\\Media\\\\chimes.wav\') { (New-Object Media.SoundPlayer \'C:\\\\Windows\\\\Media\\\\chimes.wav\').PlaySync() }"'
                : 'echo "\\a"',
            },
          ],
        },
      ],
    },
    defaults: {
      reviewOnComplete: true,
      requirePlanApproval: true,
      reviewerSkill: 'enhanced-reviewer',
    },
  };
  write(
    path.join(dir, 'settings.json'),
    JSON.stringify(settings, null, 2) + '\n',
  );

  // Commands
  for (const [name, cmd] of Object.entries(SLASH_COMMANDS)) {
    write(
      path.join(dir, 'commands', `${name}.md`),
      cmd.claude,
    );
  }

  // Agents
  for (const [name, meta] of Object.entries(AGENT_META)) {
    const guidelineRefs = meta.guidelines
      .map(g => `Read ${g.replace('.md', '')} from \`.sdlc/guidelines/${g}\`.`)
      .join('\n');

    const content = `---
name: ${name}
description: "${meta.description}"
---

Read and follow your role instructions from \`.sdlc/agents/${name}.md\`.
${guidelineRefs}

${meta.extra}
`;
    write(path.join(dir, 'agents', `${name}.md`), content);
  }

  // Skills — copy from .sdlc/skills/*/SKILL.md
  for (const skill of skills) {
    write(
      path.join(dir, 'skills', `SKILL.${skill.name}.md`),
      skill.content,
    );
  }

  return results;
}

// ---------------------------------------------------------------------------
// Generator: GitHub Copilot (.github/)
// ---------------------------------------------------------------------------

function generateCopilot(skills, _installedPlugins, sourceDir = PACKAGE_DIR) {
  const dir = path.join(PROJECT_DIR, '.github');
  const results = { created: 0, updated: 0, unchanged: 0, files: [] };

  function write(filePath, content) {
    const status = writeIfChanged(filePath, content);
    results[status]++;
    results.files.push(path.relative(PROJECT_DIR, filePath).split(path.sep).join('/'));
  }

  // copilot-instructions.md
  const agentsMdPath = path.join(sourceDir, '.sdlc', 'AGENTS.md');
  if (fs.existsSync(agentsMdPath)) {
    const instructions = readFile(agentsMdPath);
    const copilotInstructions = instructions
      .replace(/- sdlc-lead/g, '- @sdlc-lead')
      .replace(/- sdlc-coder/g, '- @sdlc-coder')
      .replace(/- sdlc-tester/g, '- @sdlc-tester')
      .replace(/- sdlc-reviewer/g, '- @sdlc-reviewer')
      .replace(/- sdlc-security/g, '- @sdlc-security');
    write(path.join(dir, 'copilot-instructions.md'), copilotInstructions);
  }

  // Prompts (commands)
  for (const [name, cmd] of Object.entries(SLASH_COMMANDS)) {
    const content = `---
name: ${name}
description: "${cmd.description}"
---

${cmd.copilot}`;
    write(path.join(dir, 'prompts', `${name}.prompt.md`), content);
  }

  // Agents
  for (const [name, meta] of Object.entries(AGENT_META)) {
    const shortDesc = meta.description.split(' — ')[1] || meta.description;
    const guidelineRefs = meta.guidelines
      .map(g => `Read ${g.replace('.md', '')} from \`.sdlc/guidelines/${g}\`.`)
      .join('\n');
    const extra = meta.copilotExtra || meta.extra;

    const content = `---
name: ${name}
description: "${shortDesc.charAt(0).toUpperCase() + shortDesc.slice(1)}"
tools: ["read", "edit", "search", "terminal"]
---

Read and follow your role instructions from \`.sdlc/agents/${name}.md\`.
${guidelineRefs}

${extra}
`;
    write(path.join(dir, 'agents', `${name}.agent.md`), content);
  }

  return results;
}

// ---------------------------------------------------------------------------
// Generator: OpenAI Codex (.codex/)
// ---------------------------------------------------------------------------

function generateCodex(_skills, _installedPlugins) {
  const dir = path.join(PROJECT_DIR, '.codex');
  const results = { created: 0, updated: 0, unchanged: 0, files: [] };

  function write(filePath, content) {
    const status = writeIfChanged(filePath, content);
    results[status]++;
    results.files.push(path.relative(PROJECT_DIR, filePath).split(path.sep).join('/'));
  }

  // config.toml
  const config = `# Codex configuration for SDLC project

[agents]
max_threads = 6
max_depth = 1

[features]
multi_agent = true
`;
  write(path.join(dir, 'config.toml'), config);

  // Agents
  for (const [name, meta] of Object.entries(AGENT_META)) {
    const guidelineRefs = meta.guidelines
      .map(g => `Read ${g.replace('.md', '')} from \`.sdlc/guidelines/${g}\`.`)
      .join('\n');
    const extra = meta.codexExtra || meta.extra;
    const reasoning = meta.codexReasoning
      ? `\nmodel_reasoning_effort = "${meta.codexReasoning}"`
      : '';

    const content = `name = "${name}"
description = "${meta.description.split(' — ')[1] || meta.description}"
sandbox_mode = "workspace-write"${reasoning}

developer_instructions = """
Read and follow your role instructions from \`.sdlc/agents/${name}.md\`.
${guidelineRefs}

${extra}
"""
`;
    write(path.join(dir, 'agents', `${name}.toml`), content);
  }

  return results;
}

// ---------------------------------------------------------------------------
// Manifest
// ---------------------------------------------------------------------------

function writeManifest(files, platforms) {
  const manifestPath = path.join(PROJECT_DIR, MANIFEST_REL);
  let createdAt;
  if (fs.existsSync(manifestPath)) {
    const raw = readFile(manifestPath);
    try {
      createdAt = JSON.parse(raw).createdAt;
    } catch (err) {
      if (!(err instanceof SyntaxError)) throw err;
      // Corrupted manifest — treat as new install
    }
  }

  const now = new Date().toISOString();
  const pkg = JSON.parse(readFile(path.join(PACKAGE_DIR, 'package.json')));

  const manifest = {
    version: pkg.version,
    createdAt: createdAt || now,
    updatedAt: now,
    platforms: [...platforms].sort(),
    files: [...files].sort(),
    gitignoreBlock: true,
  };

  ensureDir(path.dirname(manifestPath));
  fs.writeFileSync(
    manifestPath,
    JSON.stringify(manifest, null, 2) + '\n',
    'utf8',
  );
}

// ---------------------------------------------------------------------------
// Copy .sdlc/ to user's project
// ---------------------------------------------------------------------------

function copyAgentsToProject() {
  const dest = path.join(PROJECT_DIR, '.sdlc');

  // If running inside the package itself, skip copy
  if (PACKAGE_DIR === PROJECT_DIR) return 'skipped (same directory)';

  copyDirRecursive(AGENTS_SRC, dest);
  return 'copied';
}

// ---------------------------------------------------------------------------
// Common setup (in user's project)
// ---------------------------------------------------------------------------

function setupCommon() {
  // Ensure sdlc-doc/workflows/ exists
  ensureDir(path.join(PROJECT_DIR, 'sdlc-doc', 'workflows'));

  // Copy AGENTS.md to project root
  let agentsMdWritten = false;
  const agentsMdSrc = path.join(PACKAGE_DIR, '.sdlc', 'AGENTS.md');
  if (fs.existsSync(agentsMdSrc)) {
    writeIfChanged(path.join(PROJECT_DIR, 'AGENTS.md'), readFile(agentsMdSrc));
    agentsMdWritten = true;
  }

  // Write \.sdlc/config.json so skill preamble can locate .sdlc/assets/server/start.py
  writeIfChanged(
    path.join(PROJECT_DIR, '\.sdlc/config.json'),
    JSON.stringify({ package_dir: PACKAGE_DIR }, null, 2) + '\n',
  );

  // Ensure .gitignore has the right entries
  const gitignorePath = path.join(PROJECT_DIR, '.gitignore');
  const requiredEntries = [
    '# Personal settings',
    '.claude/settings.local.json',
    '.env',
    '',
    '# Working memory + local docs (uncommitted)',
    'sdlc-doc/*',
    '!sdlc-doc/architecture.html',
    '',
    '# Generated by npx sdlc init — derived from .sdlc/ source of truth',
    '.claude/',
    '.github/',
    '.codex/',
    'AGENTS.md',
  ];

  const gitignoreContent = requiredEntries.join('\n') + '\n';

  let gitignoreStatus;

  // Append to existing .gitignore or create new one
  if (fs.existsSync(gitignorePath)) {
    const existing = readFile(gitignorePath);
    if (existing.includes('# Generated by')) {
      // Replace existing generated block
      const cleaned = existing.replace(/# Generated by[^\n]*\n[\s\S]*$/, '').trimEnd();
      const merged = cleaned + '\n\n' + requiredEntries.slice(requiredEntries.indexOf('# Generated by npx sdlc init — derived from .sdlc/ source of truth')).join('\n') + '\n';
      if (existing !== merged) {
        fs.writeFileSync(gitignorePath, merged, 'utf8');
        gitignoreStatus = 'updated';
      } else {
        gitignoreStatus = 'unchanged';
      }
    } else {
      // Append if no generated block exists
      fs.appendFileSync(gitignorePath, '\n' + gitignoreContent);
      gitignoreStatus = 'updated';
    }
  } else {
    fs.writeFileSync(gitignorePath, gitignoreContent, 'utf8');
    gitignoreStatus = 'created';
  }

  return { gitignoreStatus, agentsMdWritten };
}

// ---------------------------------------------------------------------------
// Init command
// ---------------------------------------------------------------------------

const PLATFORMS = {
  claude: { name: 'Claude Code', dir: '.claude/', generate: generateClaude },
  copilot: { name: 'GitHub Copilot', dir: '.github/', generate: generateCopilot },
  codex: { name: 'OpenAI Codex', dir: '.codex/', generate: generateCodex },
};

async function runInit() {
  console.log('\n  SDLC System Setup\n');

  // Verify .sdlc/ exists in package
  if (!fs.existsSync(AGENTS_SRC)) {
    console.error('  ✗ .sdlc/ not found in package. Installation may be corrupted.');
    process.exit(1);
  }

  // Determine platform
  let choice = process.argv[2]?.toLowerCase();

  if (!choice) {
    console.log('  Which AI tool are you using?\n');
    console.log('    1. Claude Code');
    console.log('    2. GitHub Copilot');
    console.log('    3. OpenAI Codex');
    console.log('    4. All\n');

    const answer = await ask('  Enter choice (1-4): ');
    choice = { '1': 'claude', '2': 'copilot', '3': 'codex', '4': 'all' }[answer];

    if (!choice) {
      console.log('  Invalid choice.');
      process.exit(1);
    }
  }

  const platforms = choice === 'all'
    ? Object.keys(PLATFORMS)
    : [choice];

  // Discover source of truth
  const skills = discoverSkills();
  const agents = discoverAgents();
  const installedPlugins = detectInstalledPlugins();
  console.log(`\n  Source: .sdlc/ — ${skills.length} skills, ${agents.length} agents`);
  if (installedPlugins.length > 0) {
    console.log(`  Plugins detected: ${installedPlugins.join(', ')}`);
  }
  console.log();

  // Copy .sdlc/ to project (if running as npm package)
  const agentsCopyStatus = copyAgentsToProject();
  console.log(`  .sdlc/          ${agentsCopyStatus}`);

  // Common setup
  const { gitignoreStatus, agentsMdWritten } = setupCommon();
  console.log(`  .gitignore        ${gitignoreStatus}`);
  console.log(`  sdlc-doc/workflows/   ${fs.existsSync(path.join(PROJECT_DIR, 'sdlc-doc', 'workflows')) ? 'ready' : 'created'}`);

  // Generate platform files and collect their file lists
  const platformFiles = [];
  const generatedPlatforms = [];
  for (const key of platforms) {
    const platform = PLATFORMS[key];
    if (!platform) {
      console.log(`\n  ✗ Unknown platform: ${key}`);
      continue;
    }

    console.log(`\n  Generating ${platform.dir} (${platform.name})...`);
    const results = platform.generate(skills, installedPlugins);
    platformFiles.push(...results.files);
    generatedPlatforms.push(key);
    console.log(`    ${results.created} created, ${results.updated} updated, ${results.unchanged} unchanged`);
  }

  // Build manifest file list: .sdlc/ contents + platform files + AGENTS.md
  const agentsFiles = listFilesRecursive(path.join(PROJECT_DIR, '.sdlc'), PROJECT_DIR)
    .filter(f => f !== MANIFEST_REL);
  const allFiles = [
    ...agentsFiles,
    ...platformFiles,
    ...(agentsMdWritten ? ['AGENTS.md'] : []),
  ];

  writeManifest(allFiles, generatedPlatforms);

  // Scan for active workflows
  const workflowsDir = path.join(PROJECT_DIR, 'sdlc-doc', 'workflows');
  let activeWorkflows = [];
  if (fs.existsSync(workflowsDir)) {
    const scanDir = (dir) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          scanDir(fullPath);
        } else if (entry.name === 'manifest.json') {
          try {
            const manifest = JSON.parse(readFile(fullPath));
            const lastPhase = Object.entries(manifest.phases || {}).reverse()
              .find(([, v]) => v.status !== 'pending');
            if (lastPhase && lastPhase[1].status !== 'approved') {
              activeWorkflows.push({
                slug: manifest.slug,
                type: manifest.workflow_type,
                phase: manifest.current_phase,
                path: fullPath,
              });
            }
          } catch {}
        }
      }
    };
    scanDir(workflowsDir);
  }

  console.log('\n  ─────────────────────────────────');
  console.log('  Setup complete.\n');

  if (activeWorkflows.length > 0) {
    console.log('  Active workflows:');
    for (const w of activeWorkflows) {
      console.log(`    • ${w.slug} (${w.type}) — phase: ${w.phase}`);
    }
    console.log('\n  Run /sdlc:resume to continue.\n');
  } else {
    console.log('  No active workflows. Run /sdlc to start one.\n');
  }
}

// ---------------------------------------------------------------------------
// Update command — regenerate platform files from project's .sdlc/
// ---------------------------------------------------------------------------

async function runUpdate() {
  console.log('\n  SDLC Update\n');

  const projectAgentsDir = path.join(PROJECT_DIR, '.sdlc');

  if (!fs.existsSync(projectAgentsDir)) {
    console.error('  ✗ No .sdlc/ found in this project. Run npx sdlc init first.');
    process.exit(1);
  }

  const platformArg = process.env.SDLC_UPDATE_PLATFORM?.toLowerCase();
  let platformKeys;

  if (platformArg && platformArg !== 'all') {
    if (!PLATFORMS[platformArg]) {
      console.error(`  ✗ Unknown platform: ${platformArg}`);
      process.exit(1);
    }
    platformKeys = [platformArg];
  } else if (platformArg === 'all') {
    platformKeys = Object.keys(PLATFORMS);
  } else {
    platformKeys = Object.keys(PLATFORMS).filter(key =>
      fs.existsSync(path.join(PROJECT_DIR, PLATFORMS[key].dir)),
    );
  }

  if (platformKeys.length === 0) {
    console.error('  ✗ No platform directories found. Run npx sdlc init first.');
    process.exit(1);
  }

  const skills = discoverSkills(projectAgentsDir);
  const installedPlugins = detectInstalledPlugins();

  console.log(`  Source: .sdlc/ — ${skills.length} skills`);
  if (installedPlugins.length > 0) {
    console.log(`  Plugins detected: ${installedPlugins.join(', ')}`);
  }
  console.log();

  // Generate updated platforms and collect their file lists
  const updatedFiles = [];
  for (const key of platformKeys) {
    const platform = PLATFORMS[key];
    console.log(`  Generating ${platform.dir} (${platform.name})...`);
    const results = platform.generate(skills, installedPlugins, PROJECT_DIR);
    updatedFiles.push(...results.files);
    console.log(`    ${results.created} created, ${results.updated} updated, ${results.unchanged} unchanged`);
  }

  // Read existing manifest to preserve entries for non-updated platforms
  const manifestPath = path.join(PROJECT_DIR, MANIFEST_REL);
  let existingManifest = null;
  if (fs.existsSync(manifestPath)) {
    try {
      existingManifest = JSON.parse(readFile(manifestPath));
    } catch (err) {
      if (!(err instanceof SyntaxError)) throw err;
      // Corrupted manifest — treat as missing
    }
  }

  const updatedDirs = platformKeys.map(k => PLATFORMS[k].dir); // e.g. ['.claude/']

  // Preserve manifest entries that belong to platform dirs we did NOT update.
  // We re-enumerate .sdlc/ fresh below, so exclude .sdlc/ here.
  const preservedFiles = (existingManifest?.files || []).filter(f => {
    if (f.startsWith('.sdlc/')) return false;          // re-enumerated fresh
    if (f === 'AGENTS.md') return false;                  // re-checked fresh
    // Keep entries whose path does NOT start with any updated platform dir
    return !updatedDirs.some(d => f.startsWith(d));
  });

  // Re-enumerate .sdlc/ (user may have added/removed skills since last init)
  const agentsFiles = listFilesRecursive(projectAgentsDir, PROJECT_DIR)
    .filter(f => f !== MANIFEST_REL);

  const agentsMdExists = fs.existsSync(path.join(PROJECT_DIR, 'AGENTS.md'));

  // Union of platforms: existing platforms + currently updated ones
  const mergedPlatforms = [...new Set([
    ...(existingManifest?.platforms || []),
    ...platformKeys,
  ])];

  writeManifest(
    [
      ...agentsFiles,
      ...preservedFiles,
      ...updatedFiles,
      ...(agentsMdExists ? ['AGENTS.md'] : []),
    ],
    mergedPlatforms,
  );

  console.log('\n  ─────────────────────────────────');
  console.log('  Update complete.\n');
}

// ---------------------------------------------------------------------------
// Uninstall command — remove all sdlc-generated files based on the manifest
// ---------------------------------------------------------------------------

async function runUninstall() {
  console.log('\n  SDLC Uninstall\n');

  const manifestPath = path.join(PROJECT_DIR, MANIFEST_REL);

  if (!fs.existsSync(manifestPath)) {
    console.error('  ✗ No sdlc installation found in this project. Run npx sdlc init first.');
    process.exit(1);
  }

  let manifest;
  try {
    manifest = JSON.parse(readFile(manifestPath));
  } catch (err) {
    if (!(err instanceof SyntaxError)) throw err;
    console.error('  ✗ Manifest file is corrupted. Cannot uninstall automatically.');
    process.exit(1);
  }

  if (!Array.isArray(manifest.files)) {
    console.error('  ✗ Manifest is missing files list. Cannot uninstall automatically.');
    process.exit(1);
  }

  let deletedFiles = 0;
  let deletedDirs = 0;

  // Step 2: Delete every file listed in the manifest
  for (const relPath of manifest.files) {
    const fullPath = path.join(PROJECT_DIR, relPath);
    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
      fs.unlinkSync(fullPath);
      deletedFiles++;
    }
  }

  // Step 3: Remove parent directories that became empty.
  // Collect all ancestor directories of deleted files, then attempt to remove
  // them deepest-first. Skip non-empty directories (preserves user files).
  const ancestorDirs = new Set();
  for (const relPath of manifest.files) {
    let dir = path.dirname(path.join(PROJECT_DIR, relPath));
    while (dir.length > PROJECT_DIR.length) {
      ancestorDirs.add(dir);
      dir = path.dirname(dir);
    }
  }

  const sortedDirs = [...ancestorDirs].sort(
    (a, b) => b.split(path.sep).length - a.split(path.sep).length,
  );

  for (const dir of sortedDirs) {
    if (fs.existsSync(dir) && fs.readdirSync(dir).length === 0) {
      fs.rmdirSync(dir);
      deletedDirs++;
    }
  }

  // Step 4: Strip the generated block from .gitignore
  let gitignoreCleaned = false;
  if (manifest.gitignoreBlock) {
    const gitignorePath = path.join(PROJECT_DIR, '.gitignore');
    if (fs.existsSync(gitignorePath)) {
      const original = readFile(gitignorePath);
      const cleaned = original.replace(/\n*# Generated by npx sdlc init[^\n]*\n[\s\S]*$/, '');
      const final = cleaned.length > 0 ? cleaned.trimEnd() + '\n' : '';
      if (final !== original) {
        if (final.length === 0) {
          fs.unlinkSync(gitignorePath);
        } else {
          fs.writeFileSync(gitignorePath, final, 'utf8');
        }
        gitignoreCleaned = true;
      }
    }
  }

  // Step 5: Delete .sdlc/ entirely (this removes the manifest itself last)
  const agentsDir = path.join(PROJECT_DIR, '.sdlc');
  if (fs.existsSync(agentsDir)) {
    fs.rmSync(agentsDir, { recursive: true, force: true });
  }

  // Step 6: Summary
  console.log('  ─────────────────────────────────');
  console.log('  Uninstall complete.\n');
  console.log(`    Files removed:        ${deletedFiles}`);
  console.log(`    Directories removed:  ${deletedDirs + 1} (.sdlc/ + ${deletedDirs} empty)`);
  if (gitignoreCleaned) {
    console.log('    .gitignore:           generated block removed');
  }
  console.log();
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  if (COMMAND === 'uninstall') {
    await runUninstall();
  } else if (COMMAND === 'update') {
    await runUpdate();
  } else {
    await runInit();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
