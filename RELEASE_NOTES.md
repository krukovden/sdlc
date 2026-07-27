# Release Notes

---

## 2026-07-27

### The Board Moves Again, and the Tail of the Pipeline Runs

Two defects with the same shape: the rule was written somewhere the Lead does not look while the pipeline is in flight.

**The kanban jumped queue → done.** The per-transition manifest rule lived in a *Manifest Update* section at the far end of `implement.md`, while the loop the Lead actually follows said only "parse → check → dispatch next". The manifest write is now a numbered step of that loop, on both sides of every dispatch. `sdlc-lead.md` no longer says to "set all remaining agent statuses to `passed`" when a task completes — that one instruction backdated verdicts nobody rendered and marked agents that never ran as passed, which is the queue → done jump itself. Each status is written when it is earned, or it is `skipped` with a reason.

**Security and the Rubber Duck were falling off the end.** They sit at the tail of the sequence, which is where a dropped agent is cheapest to not notice.

- The mediated-mode sequence stopped at Security — an enabled Rubber Duck was never dispatched there at all
- The dispatch loop now gates the compliance check on all six agents holding a terminal status (`passed`/`failed`/`skipped`); an agent still `pending` means a dispatch was skipped, not a write
- Skip conditions are narrowed to the one stated ground — a task of pure declarations — with "small", "low-risk", "already covered", and "taking too long" named as non-reasons. Every skip is recorded twice: `skipped` in the manifest and a reason in `04-implementation-log.md`
- The Lead's Rubber Duck model table named versioned ids (`claude-opus-4-7`). A retired version string is rejected by the dispatch tool's `model` parameter, the dispatch fails, and the Duck silently never runs. It now reads the tiers the tool offers at call time and passes a tier alias — and when the tool exposes no `model` parameter it dispatches anyway, with the Duck disclosing the same-model run in its verdict
- The workflow definitions (`feature`, `bugfix`, `refactor`) show the Rubber Duck in the pipeline diagram and the activation table, instead of ending at Security

### Lead is the Sole Dispatcher — Autonomous Pipeline No Longer Stalls

Agents no longer spawn their successors. The Lead dispatches every agent in the sequence itself, in autonomous mode as well as mediated.

The old chaining (Coder spawns Tester, Tester spawns Reviewer, …) needed a spawn tool *inside* each dispatched agent. Most harnesses give the top-level Coder one and give a dispatched Tester or Reviewer none — so the chain ran Coder → Tester and stopped there, the Tester holding a finished result it had no way to forward. The Lead saw only an idle notification and could not tell *done* from *stalled*. In practice that showed up as an 18-minute hang on a task whose work was already complete.

- **Autonomous mode** now means the Lead dispatches straight through with no deliberation and no stop-gate between agents — not that the agents chain themselves
- **Mediated mode** is unchanged: the Lead reads each output in full and may adjust course between handoffs
- **Retries are Lead-driven in both modes.** An agent that fails returns its findings and the files to fix; the Lead dispatches the Coder and re-dispatches it. Each agent keeps its budget of 3 cycles — the Lead is the one counting
- **Every agent definition now carries the same non-negotiable:** return your result as your final message, never go idle, and if you were asked to spawn a successor and cannot, return immediately with a note naming which agents still need to run
- Letting the Coder drive the whole chain survives as an opt-in per task, for harnesses where that has been verified to work

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
