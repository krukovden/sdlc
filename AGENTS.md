# Project Instructions

## Source of Truth

All shared knowledge lives in `.agents/`:
- **Skills:** `.agents/skills/` (domain knowledge, SDLC phases)
- **Agent instructions:** `.agents/agents/` (role definitions)
- **Guidelines:** `.agents/guidelines/` (conventions, principles, error handling, testing)
- **Workflows:** `.agents/workflows/` (feature, bugfix, refactor, spike definitions)

Read and apply these guidelines for ALL work:
- `.agents/guidelines/conventions.md` — tech stack and file conventions
- `.agents/guidelines/principles.md` — SOLID, KISS, YAGNI, DRY
- `.agents/guidelines/error-handling.md` — error handling and scalability
- `.agents/guidelines/testing.md` — testing strategy and non-negotiables

## Tech Stack

- Frontend: Angular 18+
- Backend: Node/TypeScript + C# Azure Functions
- CI/CD: GitHub Actions + Azure Pipelines

## SDLC Workflows

Workflow types: feature, bugfix, refactor, spike.
Workflow definitions are in `.agents/workflows/`.

## Agents

Agent roles are defined in `.agents/agents/`:
- sdlc-lead — orchestrates workflow phases
- sdlc-coder — writes implementation code
- sdlc-tester — writes and runs tests
- sdlc-reviewer — reviews code quality
- sdlc-security — security analysis

## Working Memory

Active workflows are tracked in `docs/workflows/` (not committed to git).
On session start, check `docs/workflows/` for active workflows to resume.

## Non-Negotiables

- Never write code before a spec/plan is approved
- Every task gets exactly ONE role skill
- Secrets never in source — always Key Vault / GitHub Secrets
