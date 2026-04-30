# Scenario 2: Context Switching Test

## Goal

Verify that different AI tools can hand off an SDLC workflow to each other using shared `sdlc-doc/workflows/` artifacts in a single workspace.

## Task

`/sdlc feature "add POST /echo endpoint that returns the request body"`

## What it tests

All three tools share ONE workspace (no per-tool folders). Each tool picks up `sdlc-doc/workflows/` from the previous tool and continues.

1. **Claude** starts the workflow — runs clarify, research (stops)
2. **Copilot** resumes — runs design (stops)
3. **Codex** resumes — runs plan, implement (finishes)

The final workspace has a complete workflow with all 5 phases approved in manifest.json.

## Workspace layout

```
Run/<workflow>/<timestamp>/
├── .sdlc/          # sdlc init all
├── .claude/          # claude config
├── .github/          # copilot config
├── .codex/           # codex config
├── AGENTS.md         # generated
├── sdlc-doc/workflows/   # shared artifacts — each tool reads & writes here
├── src/              # fixture project source
├── test/             # fixture project tests
└── package.json      # fixture project config
```

## Run

```powershell
pwsh .\run.ps1
```
