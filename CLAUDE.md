# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

An npm package (`@krukovden/sdlc`) that provides an AI-powered multi-agent SDLC system. The recommended user flow is `npx @krukovden/sdlc init ...`, which scaffolds platform-specific config files (`.claude/`, `.github/`, `.codex/`) into the project without adding the package to `package.json`.

## Architecture

**Three-layer design:** Commands (entry points) → Skills (orchestration logic) → Agents (isolated execution).

- `bin/sdlc.js` — CLI entry point, delegates to `setup.js`
- `setup.js` — Core generator. Reads `.agents/` from the package, discovers skills/agents, and writes platform-specific files into the user's project directory. Contains generators for Claude Code, GitHub Copilot, and OpenAI Codex.
- `.agents/` — Source of truth (committed). Contains all agent definitions, skills, guidelines, and workflow definitions. Platform files are derived from this.
- `docs/workflows/` — Working memory for active SDLC workflows (not committed)
- `.claude/`, `.github/`, `.codex/` — Generated output (not committed, listed in `.gitignore`)

Key detail: `PACKAGE_DIR` (where `.agents/` lives) vs `PROJECT_DIR` (user's cwd) distinction in `setup.js` is critical — when run as an npm package these differ.

## Commands

```bash
# Test the CLI locally
node bin/sdlc.js init claude    # Generate .claude/ config
node bin/sdlc.js init copilot   # Generate .github/ config
node bin/sdlc.js init codex     # Generate .codex/ config
node bin/sdlc.js init all       # Generate all platforms
node bin/sdlc.js help           # Show help
```

No build step, no linter configured. Pure Node.js with zero dependencies.

## Testing

Two-tier integration test suite using `node:test` (built-in, zero dependencies).

```bash
npm test                         # Run tier1 tests (default)
node Testing/run.js tier1        # Same as above
node Testing/run.js tier2        # Run tier2 (requires real CLIs + API keys)
node Testing/run.js tier2 claude # Run tier2 for claude only
node Testing/run.js all          # Run both tiers
npx playwright test Testing/tier2/html-visual.test.js  # Visual tests (requires Playwright)
```

- **Tier 1** (`Testing/tier1/`) — deterministic file generation tests. Validates init output for all platforms, cross-platform consistency, agent-skill isolation, workflow schemas, HTML structure. No AI calls. Runs on every commit via CI.
- **Tier 2** (`Testing/tier2/`) — end-to-end workflow execution through real CLI tools. Validates full SDLC workflows, cross-tool resume, dashboard sync. Manual/scheduled via CI `workflow_dispatch`.
- **Helpers** (`Testing/helpers/`) — `file-assertions.js` (reusable file checks), `temp-project.js` (temp dir scaffolding), `cli-runner.js` (CLI process management), `artifact-validator.js` (workflow artifact validation).
- **Fixtures** (`Testing/fixtures/test-project/`) — minimal Express/TS project used as tier2 target.

## Publishing

Published to GitHub Packages (`npm.pkg.github.com`) via manual `workflow_dispatch` on `.github/workflows/publish.yml`. Patch version auto-increments from git tags based on the `major.minor` input.

## Key Conventions

- `.agents/` is the single source of truth — all platform configs are derived from it
- `AGENTS.md` at the project root is generated (gitignored), not hand-edited
- `setup.js` uses `writeIfChanged()` to avoid unnecessary file writes
- Agent metadata (`AGENT_META` in `setup.js`) defines per-agent descriptions, guideline refs, and platform-specific extras
- Slash commands (`SLASH_COMMANDS` in `setup.js`) have separate `claude` and `copilot` prompt variants
