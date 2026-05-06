# Testing

Two-tier test suite for the SDLC multi-agent system. Tier 1 validates the package itself (file generation). Tier 2 validates end-to-end SDLC workflows through real AI CLI tools.

## Quick Reference

```bash
npm test                                           # tier 1 (default)
node Testing/run.js tier1                          # same as above
node Testing/run.js tier1 --keep                   # keep generated files for inspection
node Testing/run.js --clean                        # delete Testing/runs/

pwsh Testing/tier2/run-scenarios.ps1               # all tier 2 scenarios
pwsh Testing/tier2/run-scenarios.ps1 -Scenario scenario-1-consistency   # one scenario
pwsh Testing/tier2/scenario-1-consistency/run.ps1  # run scenario directly
```

## Tier 1 — File Generation Tests

**Purpose:** Verify that `npx sdlc init` generates correct platform config files from `.sdlc/` source of truth.

**Runtime:** ~2 seconds. No AI calls, no network, no API keys. Runs on every commit via CI.

**How it works:**
1. Creates a temp directory in `Testing/runs/`
2. Copies `.sdlc/`, `setup.js`, `bin/` from the package root
3. Runs `node bin/sdlc.js init <platform>`
4. Asserts generated files exist, have correct content, and follow expected patterns
5. Cleans up the temp directory (unless `--keep`)

**Tests** (`Testing/tier1/`):

| Test | What it checks |
|------|---------------|
| `init-claude.test.js` | `.claude/` config generation |
| `init-copilot.test.js` | `.github/` config generation |
| `init-codex.test.js` | `.codex/` config generation |
| `init-all.test.js` | `init all` generates all three platforms |
| `cross-platform.test.js` | Same agents/skills/workflows across platforms |
| `agent-isolation.test.js` | Each agent only references its own guidelines |
| `workflow-schemas.test.js` | Workflow definition files are valid |
| `html-structure.test.js` | Generated HTML files are well-formed |

**Helpers** (`Testing/helpers/`):

| File | Purpose |
|------|---------|
| `temp-project.js` | Creates temp test directories with package files |
| `file-assertions.js` | Assertion utilities: file existence, content patterns, format validation |
| `expected-state.js` | Parses expected state from `setup.js` and `.sdlc/` directory |

## Tier 2 — End-to-End Scenario Tests

**Purpose:** Validate that real AI CLI tools (Claude Code, GitHub Copilot, OpenAI Codex) can execute SDLC workflows and produce correct artifacts.

**Runtime:** 10-45 minutes per scenario. Requires real CLI tools installed and API keys configured. Manual or scheduled via CI `workflow_dispatch`.

**How it works:**
1. Each scenario has its own directory with `scenario.json`, `run.ps1`, and `project/`
2. `Setup-Workspace.ps1` copies `project/` into `Run/` and runs `sdlc init`
3. `Invoke-Tool.ps1` sends a minimal prompt to the AI tool (e.g. `/sdlc feature --auto-approve "task"`)
4. `Assert-Workflow.ps1` validates: all phases approved in `manifest.json`, all required artifacts exist

**Scenarios** (`Testing/tier2/`):

### Scenario 1: Consistency

Runs all three tools independently with the same task. Checks that each tool produces the same artifact structure.

```
scenario-1-consistency/
├── project/          ← target Express project that AI tools analyze
├── scenario.json     ← config: task, tools, phases
└── run.ps1           ← runs 3 tools, validates files, compares structure
```

What it validates:
- Each tool creates all required artifacts (manifest, clarify, research, design docs, plan, implementation log)
- All phases are marked `approved` in `manifest.json`
- All three tools produce the same set of files

### Scenario 2: Context Switch

Runs three tools in sequence from one shared workspace. Each tool picks up where the previous one stopped.

```
scenario-2-context-switch/
├── project/          ← target Express project
├── scenario.json     ← config: step chain with stopAt phases
└── run.ps1           ← one workspace, 3 tools in sequence
```

What it validates:
- Tool A starts a workflow, stops at a specific phase
- Tool B resumes from the same `sdlc-doc/workflows/`, continues, stops
- Tool C resumes and finishes
- Final `manifest.json` has all phases `approved`

## Shared Library (`Testing/tier2/lib/`)

| File | Purpose |
|------|---------|
| `Setup-Workspace.ps1` | Creates workspace from scenario's `project/` directory, runs `sdlc init` |
| `Invoke-Tool.ps1` | Sends prompts to Claude/Copilot/Codex CLI, captures output |
| `Assert-Workflow.ps1` | Validates manifest phases and artifact file existence |

## Adding a New Scenario

1. Create `Testing/tier2/scenario-N-name/`
2. Add `project/` with the target codebase the AI tools will work on
3. Add `scenario.json` with task, tools, and phases config
4. Add `run.ps1` that calls the shared lib functions
5. The scenario will be auto-discovered by `run-scenarios.ps1`
