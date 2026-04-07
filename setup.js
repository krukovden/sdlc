#!/usr/bin/env node

/**
 * SDLC System Setup
 *
 * Reads .agents/ (source of truth) from the PACKAGE and generates
 * platform-specific adapter files in the USER'S PROJECT.
 *
 * When run as npm package (via bin/sdlc.js):
 *   PACKAGE_DIR = node_modules/sdlc/    (contains .agents/)
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
const AGENTS_SRC = path.join(PACKAGE_DIR, '.agents');
const COMMAND = process.env.SDLC_COMMAND || 'init';

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
// Discover .agents/ content (from PACKAGE)
// ---------------------------------------------------------------------------

function discoverAgents() {
  const dir = path.join(AGENTS_SRC, 'agents');
  return listFiles(dir, '.md').map(f => {
    const name = f.replace('.md', '');
    const content = readFile(path.join(dir, f));
    return { name, content };
  });
}

function discoverSkills() {
  const dir = path.join(AGENTS_SRC, 'skills');
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
    extra: 'Read the workflow definition from `.agents/workflows/` matching the current workflow type.\n\nYou are the Lead agent. You orchestrate, dispatch, and verify. You do NOT write code.',
    copilotExtra: 'You are the Lead agent. You orchestrate the SDLC workflow phases (clarify → research → design → plan → implement).\nFor implementation, coordinate work sequentially: use @sdlc-coder for code, @sdlc-tester for tests, @sdlc-reviewer for review, @sdlc-security for security analysis.',
    codexExtra: 'You are the Lead agent. You orchestrate the SDLC workflow phases (clarify → research → design → plan → implement).\nFor implementation, spawn subagents: sdlc-coder for code, sdlc-tester for tests, sdlc-reviewer for review, sdlc-security for security analysis.',
    codexReasoning: 'high',
  },
  'sdlc-coder': {
    description: 'SDLC implementation agent — writes code based on design artifacts and task specs. Does not write tests, review code, or make architectural decisions. Dispatched by Lead agent.',
    guidelines: ['conventions.md', 'principles.md'],
    extra: 'Your task will be provided by the Lead agent. Focus only on implementation.\nDo NOT write tests, review code, or make architectural decisions.',
  },
  'sdlc-tester': {
    description: 'SDLC testing agent — writes tests and verifies they pass. Reads testing-strategy.md or regression-test-plan.md per workflow type. Does not modify implementation code. Dispatched by Lead agent.',
    guidelines: ['testing.md', 'conventions.md'],
    extra: 'Your task will be provided by the Lead agent. Focus only on writing and running tests.\nDo NOT modify implementation code.',
  },
  'sdlc-reviewer': {
    description: 'SDLC code review agent — reviews code quality, SOLID/KISS/YAGNI/DRY compliance, and domain-specific patterns. Read-only — produces verdict only, does not modify code. Dispatched by Lead agent.',
    guidelines: ['principles.md', 'conventions.md'],
    extra: 'Your task will be provided by the Lead agent. Review code and produce a verdict.\nDo NOT modify any code. Output: PASS / NEEDS CHANGES / FAIL.',
  },
  'sdlc-security': {
    description: 'SDLC security analysis agent — checks for injection risks, auth/authz issues, secrets exposure, input validation gaps, and sensitive data logging. Read-only — produces assessment only. Dispatched by Lead agent.',
    guidelines: ['error-handling.md', 'conventions.md'],
    extra: 'Your task will be provided by the Lead agent. Analyze code for security issues.\nDo NOT modify any code. Output: PASS / SECURITY ISSUE.',
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

1. Read \`.agents/workflows/\` to understand workflow types (feature, bugfix, refactor, spike)
2. Detect the workflow type from the description
3. Confirm with the user
4. Follow the phase sequence defined in the matching workflow file
5. Use \`docs/workflows/<type>/<date>-<name>/\` for all artifacts
6. Stop at each phase gate for user approval

Use @sdlc-lead to orchestrate the workflow.
`,
  },
  'sdlc-clarify': {
    description: 'Run the SDLC clarify phase — refine scope, constraints, success criteria',
    claude: `Invoke the \`sdlc\` skill with phase=clarify.

If $ARGUMENTS is provided, use it as the task context.
Otherwise, look for an active workflow in docs/workflows/ (most recent manifest.json).
`,
    copilot: `Run the SDLC clarify phase for: $ARGUMENTS

1. Read the \`sdlc-clarify\` skill from \`.agents/skills/sdlc-clarify/SKILL.md\`
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
Otherwise, look for an active workflow in docs/workflows/ (most recent manifest.json).
`,
    copilot: `Run the SDLC research phase for: $ARGUMENTS

1. Read the \`sdlc-research\` skill from \`.agents/skills/sdlc-research/SKILL.md\`
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
Otherwise, look for an active workflow in docs/workflows/ (most recent manifest.json).
`,
    copilot: `Run the SDLC design phase for: $ARGUMENTS

1. Read the \`sdlc-design\` skill from \`.agents/skills/sdlc-design/SKILL.md\`
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
Otherwise, look for an active workflow in docs/workflows/ (most recent manifest.json).
`,
    copilot: `Run the SDLC plan phase for: $ARGUMENTS

1. Read the \`sdlc-plan\` skill from \`.agents/skills/sdlc-plan/SKILL.md\`
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
Otherwise, look for an active workflow in docs/workflows/ (most recent manifest.json).
`,
    copilot: `Run the SDLC implement phase for: $ARGUMENTS

1. Read the \`sdlc-implement\` skill from \`.agents/skills/sdlc-implement/SKILL.md\`
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
1. Read manifest.json from the most recent workflow folder in docs/workflows/
   (or user-specified path if $ARGUMENTS contains a path)
2. If $ARGUMENTS specifies a phase, resume from that phase
3. If no phase specified, resume from manifest's current_phase
4. Re-read all prior artifacts (they may have been manually edited)
5. If artifacts changed since producing phase, note at stop-gate
6. Restore worktree context if isolation=worktree

If no active workflow found, tell the user and suggest /sdlc to start a new one.
`,
    copilot: `Resume an SDLC workflow.

1. Read the most recent \`manifest.json\` from \`docs/workflows/\`
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
  const results = { created: 0, updated: 0, unchanged: 0 };

  function track(status) { results[status]++; }

  const hasSuperpowers = installedPlugins.includes('superpowers');

  // CLAUDE.md — rich platform-specific config
  const skillTable = skills
    .filter(s => !s.name.startsWith('sdlc'))
    .map(s => `| ${s.meta.description?.split(' — ')[0] || s.name} | \`${s.name}\` |`)
    .join('\n');

  const claudeMd = `# MY DEVELOPMENT SYSTEM

## Source of Truth

All shared knowledge lives in \`.agents/\`:
- **Skills:** \`.agents/skills/\` (domain knowledge, SDLC phases)
- **Agent instructions:** \`.agents/agents/\` (role definitions)
- **Guidelines:** \`.agents/guidelines/\` (conventions, principles, error handling, testing)
- **Workflows:** \`.agents/workflows/\` (feature, bugfix, refactor, spike definitions)

Read and apply these guidelines for ALL work:
- \`.agents/guidelines/conventions.md\` — tech stack and file conventions
- \`.agents/guidelines/principles.md\` — SOLID, KISS, YAGNI, DRY
- \`.agents/guidelines/error-handling.md\` — error handling and scalability
- \`.agents/guidelines/testing.md\` — testing strategy and non-negotiables

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
  track(writeIfChanged(path.join(dir, 'CLAUDE.md'), claudeMd));

  // QUICKSTART.md
  const quickstart = `# Quick Start

Run \`/sdlc feature "description"\` to start a workflow.
Run \`/sdlc:resume\` to resume an existing workflow.

See README.md for full documentation.
`;
  track(writeIfChanged(path.join(dir, 'QUICKSTART.md'), quickstart));

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
  track(writeIfChanged(
    path.join(dir, 'settings.json'),
    JSON.stringify(settings, null, 2) + '\n',
  ));

  // Commands
  for (const [name, cmd] of Object.entries(SLASH_COMMANDS)) {
    track(writeIfChanged(
      path.join(dir, 'commands', `${name}.md`),
      cmd.claude,
    ));
  }

  // Agents
  for (const [name, meta] of Object.entries(AGENT_META)) {
    const guidelineRefs = meta.guidelines
      .map(g => `Read ${g.replace('.md', '')} from \`.agents/guidelines/${g}\`.`)
      .join('\n');

    const content = `---
name: ${name}
description: "${meta.description}"
---

Read and follow your role instructions from \`.agents/agents/${name}.md\`.
${guidelineRefs}

${meta.extra}
`;
    track(writeIfChanged(path.join(dir, 'agents', `${name}.md`), content));
  }

  // Skills — copy from .agents/skills/*/SKILL.md
  for (const skill of skills) {
    track(writeIfChanged(
      path.join(dir, 'skills', `SKILL.${skill.name}.md`),
      skill.content,
    ));
  }

  return results;
}

// ---------------------------------------------------------------------------
// Generator: GitHub Copilot (.github/)
// ---------------------------------------------------------------------------

function generateCopilot(skills, _installedPlugins) {
  const dir = path.join(PROJECT_DIR, '.github');
  const results = { created: 0, updated: 0, unchanged: 0 };

  function track(status) { results[status]++; }

  // copilot-instructions.md
  const agentsMdPath = path.join(PACKAGE_DIR, 'AGENTS.md');
  if (fs.existsSync(agentsMdPath)) {
    const instructions = readFile(agentsMdPath);
    const copilotInstructions = instructions
      .replace(/## Agents\n\nAgent roles are defined in `.agents\/agents\/`:/,
        '## Agents\n\nAgent roles are defined in `.agents/agents/`. Use the corresponding agent for each role:')
      .replace(/- sdlc-lead/g, '- @sdlc-lead')
      .replace(/- sdlc-coder/g, '- @sdlc-coder')
      .replace(/- sdlc-tester/g, '- @sdlc-tester')
      .replace(/- sdlc-reviewer/g, '- @sdlc-reviewer')
      .replace(/- sdlc-security/g, '- @sdlc-security');
    track(writeIfChanged(path.join(dir, 'copilot-instructions.md'), copilotInstructions));
  }

  // Prompts (commands)
  for (const [name, cmd] of Object.entries(SLASH_COMMANDS)) {
    const content = `---
name: ${name}
description: "${cmd.description}"
---

${cmd.copilot}`;
    track(writeIfChanged(path.join(dir, 'prompts', `${name}.prompt.md`), content));
  }

  // Agents
  for (const [name, meta] of Object.entries(AGENT_META)) {
    const shortDesc = meta.description.split(' — ')[1] || meta.description;
    const guidelineRefs = meta.guidelines
      .map(g => `Read ${g.replace('.md', '')} from \`.agents/guidelines/${g}\`.`)
      .join('\n');
    const extra = meta.copilotExtra || meta.extra;

    const content = `---
name: ${name}
description: "${shortDesc.charAt(0).toUpperCase() + shortDesc.slice(1)}"
tools: ["read", "edit", "search", "terminal"]
---

Read and follow your role instructions from \`.agents/agents/${name}.md\`.
${guidelineRefs}

${extra}
`;
    track(writeIfChanged(path.join(dir, 'agents', `${name}.agent.md`), content));
  }

  return results;
}

// ---------------------------------------------------------------------------
// Generator: OpenAI Codex (.codex/)
// ---------------------------------------------------------------------------

function generateCodex(_skills, _installedPlugins) {
  const dir = path.join(PROJECT_DIR, '.codex');
  const results = { created: 0, updated: 0, unchanged: 0 };

  function track(status) { results[status]++; }

  // config.toml
  const config = `# Codex configuration for SDLC project

[agents]
max_threads = 6
max_depth = 1

[features]
multi_agent = true
`;
  track(writeIfChanged(path.join(dir, 'config.toml'), config));

  // Agents
  for (const [name, meta] of Object.entries(AGENT_META)) {
    const guidelineRefs = meta.guidelines
      .map(g => `Read ${g.replace('.md', '')} from \`.agents/guidelines/${g}\`.`)
      .join('\n');
    const extra = meta.codexExtra || meta.extra;
    const reasoning = meta.codexReasoning
      ? `\nmodel_reasoning_effort = "${meta.codexReasoning}"`
      : '';

    const content = `name = "${name}"
description = "${meta.description.split(' — ')[1] || meta.description}"
sandbox_mode = "workspace-write"${reasoning}

developer_instructions = """
Read and follow your role instructions from \`.agents/agents/${name}.md\`.
${guidelineRefs}

${extra}
"""
`;
    track(writeIfChanged(path.join(dir, 'agents', `${name}.toml`), content));
  }

  return results;
}

// ---------------------------------------------------------------------------
// Copy .agents/ to user's project
// ---------------------------------------------------------------------------

function copyAgentsToProject() {
  const dest = path.join(PROJECT_DIR, '.agents');

  // If running inside the package itself, skip copy
  if (PACKAGE_DIR === PROJECT_DIR) return 'skipped (same directory)';

  copyDirRecursive(AGENTS_SRC, dest);
  return 'copied';
}

// ---------------------------------------------------------------------------
// Common setup (in user's project)
// ---------------------------------------------------------------------------

function setupCommon() {
  // Ensure docs/workflows/ exists
  ensureDir(path.join(PROJECT_DIR, 'docs', 'workflows'));

  // Copy AGENTS.md to project root
  const agentsMdSrc = path.join(PACKAGE_DIR, 'AGENTS.md');
  if (fs.existsSync(agentsMdSrc)) {
    writeIfChanged(path.join(PROJECT_DIR, 'AGENTS.md'), readFile(agentsMdSrc));
  }

  // Ensure .gitignore has the right entries
  const gitignorePath = path.join(PROJECT_DIR, '.gitignore');
  const requiredEntries = [
    '# Personal settings',
    '.claude/settings.local.json',
    '.env',
    '',
    '# Working memory + local docs (uncommitted)',
    'docs/*',
    '!docs/architecture.html',
    '',
    '# Generated by npx sdlc init — derived from .agents/ source of truth',
    '.claude/',
    '.github/',
    '.codex/',
    'AGENTS.md',
  ];

  const gitignoreContent = requiredEntries.join('\n') + '\n';

  // Append to existing .gitignore or create new one
  if (fs.existsSync(gitignorePath)) {
    const existing = readFile(gitignorePath);
    if (existing.includes('# Generated by')) {
      // Replace existing generated block
      const cleaned = existing.replace(/# Generated by[^\n]*\n[\s\S]*$/, '').trimEnd();
      const merged = cleaned + '\n\n' + requiredEntries.slice(requiredEntries.indexOf('# Generated by npx sdlc init — derived from .agents/ source of truth')).join('\n') + '\n';
      if (existing !== merged) {
        fs.writeFileSync(gitignorePath, merged, 'utf8');
        return 'updated';
      }
      return 'unchanged';
    }
    // Append if no generated block exists
    fs.appendFileSync(gitignorePath, '\n' + gitignoreContent);
    return 'updated';
  }

  fs.writeFileSync(gitignorePath, gitignoreContent, 'utf8');
  return 'created';
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

  // Verify .agents/ exists in package
  if (!fs.existsSync(AGENTS_SRC)) {
    console.error('  ✗ .agents/ not found in package. Installation may be corrupted.');
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
  console.log(`\n  Source: .agents/ — ${skills.length} skills, ${agents.length} agents`);
  if (installedPlugins.length > 0) {
    console.log(`  Plugins detected: ${installedPlugins.join(', ')}`);
  }
  console.log();

  // Copy .agents/ to project (if running as npm package)
  const agentsCopyStatus = copyAgentsToProject();
  console.log(`  .agents/          ${agentsCopyStatus}`);

  // Common setup
  const gitignoreStatus = setupCommon();
  console.log(`  .gitignore        ${gitignoreStatus}`);
  console.log(`  docs/workflows/   ${fs.existsSync(path.join(PROJECT_DIR, 'docs', 'workflows')) ? 'ready' : 'created'}`);

  // Generate platform files
  for (const key of platforms) {
    const platform = PLATFORMS[key];
    if (!platform) {
      console.log(`\n  ✗ Unknown platform: ${key}`);
      continue;
    }

    console.log(`\n  Generating ${platform.dir} (${platform.name})...`);
    const results = platform.generate(skills, installedPlugins);
    console.log(`    ${results.created} created, ${results.updated} updated, ${results.unchanged} unchanged`);
  }

  // Scan for active workflows
  const workflowsDir = path.join(PROJECT_DIR, 'docs', 'workflows');
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
// Main
// ---------------------------------------------------------------------------

async function main() {
  await runInit();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
