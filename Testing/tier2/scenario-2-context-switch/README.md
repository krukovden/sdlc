# Scenario 2: Context Switching Test

## Goal

Verify that Tool B can pick up an SDLC workflow from where Tool A left off, using shared `docs/workflows/` artifacts as the handoff mechanism.

## Task

`/sdlc feature "add POST /echo endpoint that returns the request body"`

## What it tests

1. Claude runs phases: clarify, research, design (stops after design)
2. Copilot receives Claude's artifacts and runs phases: plan, implement
3. The final workspace has a complete workflow with all phases done

## Handoff

Claude's `docs/workflows/` folder is copied into Copilot's workspace before Copilot runs with `/sdlc:resume`.

## compareWith

Tool used for AI-powered artifact comparison.
Valid values: claude, copilot, codex

## Run

```powershell
pwsh .\run.ps1
```
