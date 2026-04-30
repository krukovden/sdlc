# Project Instructions

## Source of Truth

All shared knowledge lives in `.sdlc/`:
- **Skills:** `.sdlc/skills/` (domain knowledge, SDLC phases)
- **Agent instructions:** `.sdlc/agents/` (role definitions)
- **Guidelines:** `.sdlc/guidelines/` (conventions, principles, error handling, testing)
- **Workflows:** `.sdlc/workflows/` (feature, bugfix, refactor, spike definitions)

Read and apply these guidelines for ALL work:
- `.sdlc/guidelines/conventions.md` — tech stack and file conventions
- `.sdlc/guidelines/principles.md` — SOLID, KISS, YAGNI, DRY
- `.sdlc/guidelines/error-handling.md` — error handling and scalability
- `.sdlc/guidelines/testing.md` — testing strategy and non-negotiables

## Tech Stack

- Frontend: Angular 18+
- Backend: Node/TypeScript + C# Azure Functions
- CI/CD: GitHub Actions + Azure Pipelines

## SDLC Workflows

Workflow types: feature, bugfix, refactor, spike.
Workflow definitions are in `.sdlc/workflows/`.

## Agents

Agent roles are defined in `.sdlc/agents/`:
- sdlc-lead — orchestrates workflow phases
- sdlc-coder — writes implementation code
- sdlc-tester — writes and runs tests
- sdlc-reviewer — reviews code quality
- sdlc-security — security analysis

## Working Memory

Active workflows are tracked in `sdlc-doc/workflows/` (not committed to git).
On session start, check `sdlc-doc/workflows/` for active workflows to resume.

## Non-Negotiables

- Never write code before a spec/plan is approved
- Every task gets exactly ONE role skill
- Secrets never in source — always Key Vault / GitHub Secrets
