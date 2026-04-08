# Scenario 1 — Claude Runner

Runs the Claude Code CLI for the Consistency Test scenario.

## Quick Start

```powershell
pwsh .\run.ps1
```

Uses defaults from `../scenario.json`: feature workflow, "add POST /echo endpoint that returns the request body".

## Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `-Task` | from scenario.json | Task description passed to `/sdlc` |
| `-Workflow` | from scenario.json | Workflow type: feature, bugfix, refactor, spike |
| `-StopAt` | (none) | Stop after this phase: clarify, research, design, plan |
| `-Timeout` | from scenario.json | Timeout in ms (default 900000 = 15 min) |
| `-SkipValidation` | false | Skip artifact validation after run |

## Examples

```powershell
# Default: full feature workflow
pwsh .\run.ps1

# Custom task
pwsh .\run.ps1 -Task "add DELETE /users/:id endpoint"

# Different workflow type
pwsh .\run.ps1 -Task "GET /health returns 500" -Workflow bugfix

# Stop after design phase
pwsh .\run.ps1 -StopAt design

# Run without validation (inspect artifacts manually)
pwsh .\run.ps1 -SkipValidation
```

## What It Does

1. Creates workspace at `../Run/claude/<workflow>/<timestamp>/`
2. Copies fixture project from `Testing/fixtures/test-project/`
3. Runs `sdlc init claude` in the workspace
4. Sends expanded SDLC prompt to `claude -p` in headless mode
5. Validates manifest.json phases and artifact files

## Output

```
../Run/claude/<workflow>/<timestamp>/
  .claude/                  # from sdlc init
  .agents/                  # SDLC agent definitions
  src/                      # fixture project
  prompt.md                 # prompt sent to claude
  tool-run.log              # stdout/stderr capture
  docs/workflows/<workflow>/<date>-<slug>/
    manifest.json
    00-clarify.md
    01-research.md
    02-design/...
    03-plan.md
    04-implementation-log.md
```

## Preconditions

- `claude` CLI installed and in PATH
- `node` installed (for `sdlc init`)
