# Contributing to @krukovden/sdlc

This is the **source repo** for the npm package `@krukovden/sdlc` — an AI-powered SDLC system that generates per-platform agent configs for **Claude Code**, **GitHub Copilot**, and **OpenAI Codex CLI**.

> Do **not** run `npx sdlc` against this repo. `setup.js` short-circuits when `PACKAGE_DIR === PROJECT_DIR` (line 702), but the generated artifacts (`.claude/`, `.codex/`, `.github/copilot-instructions.md` for consumers, root `AGENTS.md` for consumers) are intentionally `.gitignore`d for consumer repos. When working **on this package**, edit the canonical `.sdlc/` sources.

## Repo layout

| Path | Role |
|---|---|
| `.sdlc/AGENTS.md` | Template **shipped to consumers** — not the active instruction file for this repo |
| `.sdlc/agents/` | Role definitions (`sdlc-lead`, `sdlc-coder`, `sdlc-tester`, `sdlc-reviewer`, `sdlc-security`, `sdlc-rubber-duck`) |
| `.sdlc/skills/` | Domain skills (architect, grilling, frontend-angular, backend-csharp, devops-azure, …) — auto-discovered, no registry |
| `ATTRIBUTION.md` | Third-party work this package adapts, and under which licence |
| `.sdlc/guidelines/` | `conventions.md`, `principles.md`, `error-handling.md`, `testing.md` |
| `.sdlc/workflows/` | `feature.md`, `bugfix.md`, `refactor.md`, `spike.md` phase definitions |
| `setup.js` | Per-platform generator (functions: `generateClaude`, `generateCopilot`, `generateCodex`) |
| `bin/sdlc.js` | npm bin entry |
| `bin/sync-copilot-instructions.js` | Copies `AGENTS.md` → `.github/copilot-instructions.md` (Copilot has no native import) |
| `testing/` | `tier1` (contract) + `tier2` (visual / E2E) test suites |

## Cross-platform agent coverage for this source repo

Three real files (no symlinks — works on Windows + macOS + Linux):

| File | Read by | Mechanism |
|---|---|---|
| `AGENTS.md` (this file) | OpenAI Codex CLI, Cursor | Native — both walk for `AGENTS.md` |
| `CLAUDE.md` | Claude Code | 1-line `@AGENTS.md` import (recursive, native) |
| `.github/copilot-instructions.md` | GitHub Copilot (IDE chat, Coding Agent, code review) | Duplicate of `AGENTS.md` (Copilot has no import mechanism) |

### Sync rule (important)

When you edit `AGENTS.md`, run:

```bash
npm run sync:copilot
```

This copies `AGENTS.md` → `.github/copilot-instructions.md` cross-platform via Node. Forgetting it means Copilot reads stale guidance. `CLAUDE.md` does not need sync (it imports `AGENTS.md` at runtime).

## Adding a new SDLC role

1. Add `.sdlc/agents/<name>.md` with the role description
2. Register in `AGENT_META` block of `setup.js`
3. If user-invocable, add to `SLASH_COMMANDS` (per-platform: `claude` / `copilot` / `codex` strings)
4. Add a contract test in `testing/tier1/`
5. Run `npm test`

## Adding a new skill

Skills are **auto-discovered** — `discoverSkills()` walks `.sdlc/skills/` (`setup.js`), so
unlike a role there is no registry entry and no `setup.js` edit. A folder containing a
`SKILL.md` is a skill; one without is ignored.

1. Add `.sdlc/skills/<name>/SKILL.md`. Frontmatter needs `name` (matching the folder) and
   `description`.
2. Shape the description as **`Short label — when to reach for it`**. `setup.js` splits on
   the first ` — ` and uses the left side as the skill's label in the generated `CLAUDE.md`
   table; the right side is what tells the agent when to fire it. A description with no
   ` — ` falls back to the folder name as its label.
3. Optional subfolders travel with the skill: `references/` for material loaded on demand,
   `scripts/` for deterministic helpers.
4. Adapted from someone else's work? Record what and from where in `ATTRIBUTION.md`.
5. Add a contract test in `testing/tier1/`.
6. Run `npm test`.

Skills whose name starts with `sdlc` are filtered out of the generated table — that is the
orchestrator itself, not domain knowledge.

## Tests

| Command | What it does |
|---|---|
| `npm test` | All tiers |
| `npm run test:tier1` | Contract tests (fast) |
| `npm run test:tier2` | Integration tests |
| `npm run test:visual` | Playwright visual regressions |

## Non-negotiables

- Never commit `.claude/`, `.codex/`, `.github/prompts/`, or `.github/agents/` — those are consumer-side generator output
- Don't edit `.sdlc/AGENTS.md` thinking it's for this repo — that file is the template shipped to consumers via `npm publish`
- Don't introduce symlinks for cross-agent file fan-out — Windows compatibility breaks
- Run `npm run sync:copilot` after editing this file
- Run `npm test` before pushing
- Secrets never in source — always Key Vault / GitHub Secrets
