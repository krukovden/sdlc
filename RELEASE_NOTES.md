# Release Notes

---

## 2026-05-06

### Rubber Duck — Cross-Model Second Opinion

A new **Rubber Duck agent** runs after Reviewer and Security with a deliberately different model. The idea: a model reviewing its own work is bounded by its own blind spots. A different model finds what the first one structurally misses.

- On **Claude Code**: if Sonnet writes the code, Opus reviews it — and vice versa
- On **Copilot**: if Claude is the primary, GPT reviews it — and vice versa
- Lead evaluates each task at plan time and enables Rubber Duck based on complexity (auth flows, multi-file changes, API boundaries). You can override per-task at the plan approval gate
- Same blocking rules as Reviewer and Security — NEEDS CHANGES sends Coder back to fix, up to 3 retries with its own independent budget

### Copilot Fleet — Parallel Task Dispatch

Independent tasks now run in parallel when using GitHub Copilot via **Copilot Fleet**. Previously parallel execution was Claude Code-only (Agent Teams). Dispatch mode is now auto-detected: Agent Teams → Fleet → sequential fallback.

---

## 2026-04-29

### Live Kanban Dashboard

A local browser dashboard opens automatically when you start a workflow. Three columns (To Do / In Progress / Done) update every 2 seconds as agents work. Each task card shows the active agent as an animated pill, full pipeline progress, and a bounce badge (↺ n) when an agent triggered a retry cycle.

No install required — pure Python stdlib. The server runs in the background and is rediscovered on session restart.

New server subcommands for manual control:

```bash
npx sdlc server start   # idempotent — safe to run if already running
npx sdlc server url     # print the dashboard URL
npx sdlc server stop    # shut down the server
```

### Update Command

```bash
npx github:krukovden/sdlc -u          # regenerate all detected platforms
npx github:krukovden/sdlc -u claude   # regenerate one platform only
```

Rewrites `.claude/`, `.github/`, `.codex/` from the current `.agents/` source. Workflow artifacts in `docs/workflows/` are not touched.

---

## 2026-04-09

### Autonomous Pipeline

Agents now chain directly without Lead mediating every handoff. Coder spawns Tester, Tester spawns Reviewer, Reviewer spawns Security — each passes a pipeline context object down the chain. Lead dispatches once and reviews the final result.

Tasks with high-risk characteristics (auth, cross-service boundaries, data migrations) still use **mediated** mode where Lead controls every handoff. Mode is assigned per-task in the plan and shown at the approval gate.

### React / Next.js Skill

Added `frontend-react` domain skill covering Next.js App Router, Server/Client component boundaries, RSC data fetching patterns, and Tailwind conventions.

### Dependency Analysis in Plan

The plan phase now explicitly maps data flow between tasks, marks which tasks can run in parallel, and validates that no task references a file or type created by a later task. The task summary table includes a dependency column and a parallel indicator.

---

## Initial Release

Five-agent SDLC system: **Lead**, **Coder**, **Tester**, **Reviewer**, **Security**. Four workflow types: `feature`, `bugfix`, `refactor`, `spike`. Five phases with user approval gates: clarify → research → design → plan → implement.

Cross-platform from the start: one `.agents/` source generates config for Claude Code, GitHub Copilot, and OpenAI Codex. Workflow artifacts in `docs/workflows/` are shared across all tools — start in Claude, resume in Copilot.
