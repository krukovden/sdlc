# Scenario 1: Consistency Test

## Goal

Verify that all three AI tools (Claude, Copilot, Codex) produce structurally consistent SDLC workflow artifacts when given the same task.

## Task

`/sdlc feature "add POST /echo endpoint that returns the request body"`

## What it tests

1. Each tool independently runs the full SDLC feature workflow
2. All tools produce the same set of artifact files (structural comparison)
3. AI-powered content comparison rates each tool's output

## compareWith

Tool used for AI-powered artifact comparison.
Valid values: claude, copilot, codex

## Run

```powershell
pwsh .\run.ps1
```
