---
name: sdlc
description: "SDLC workflow orchestrator — routes /sdlc commands to the correct workflow type (feature, bugfix, refactor, spike) and phase (clarify, research, design, plan, implement). Manages manifests, artifact folders, git isolation, and phase transitions."
---

# SDLC Master Orchestrator

## SDLC Server — Run First, Every Session

Before executing any `/sdlc` command, ensure the manifest tracking server is running:

1. Read `.sdlc/config.json` in the project root — get `package_dir`
2. Run `python <package_dir>/.sdlc/assets/server/start.py` from the project root
   - If already running: prints the URL and exits immediately (idempotent)
   - If not running: starts in background, prints URL
3. Call `GET http://localhost:7865/api/state` and print this status strip to the conversation:

```
  ┌─ SDLC ──────────────────────────────────────────────────────┐
  │  <workflow_type>: <slug>  │  phase: <current_phase>          │
  │  Tasks: <done> done · <active> active · <queued> queued      │
  │  Active: #<id> <title> → <current_agent> working             │
  │  Dashboard: http://localhost:7865                            │
  └─────────────────────────────────────────────────────────────┘
```

### Optional config keys

`.sdlc/config.json` may also carry model pins. Both are optional; when absent, the
dispatching agent detects a model from the options its dispatch tool offers at call time.

| Key | Used by | Meaning |
|-----|---------|---------|
| `architect_model` | design phase | Model for the design-it-twice alternative sub-agents |
| `rubber_duck_model` | implement phase | Model for the Rubber Duck, which must differ from the primary agents' |

Pin a **tier alias** (`opus`, `fable`, …), not a versioned id — an alias follows the tier as
it advances, a version string freezes on one release. Pin these when you want a fixed
choice or a spend cap; leave them unset to let each dispatch pick the strongest tier
currently available.

If `.sdlc/config.json` does not exist, run `npx sdlc init` first. If `/api/state` returns `active_workflow: null`, print: "No active workflow — run `/sdlc` to start one."

If the server fails to start (port taken, Python not found), print a warning and continue without the dashboard — workflow execution is not blocked.

## Iron Law — Initialization and Stop-Gates Are Mandatory

**NEVER skip initialization.** Before ANY phase work begins, you MUST:
1. Confirm workflow type with user
2. Ask about git isolation (worktree or current branch)
3. Ask about HTML dashboard
4. Create `sdlc-doc/workflows/{type}/{date}-{slug}/manifest.json`
5. Generate `dashboard.html` (if accepted)
6. Start the local HTTP server (if dashboard enabled)

**NEVER auto-advance phases.** After EVERY phase, you MUST:
1. Present the stop-gate summary to the user
2. Wait for explicit approval before proceeding
3. The ONLY exception is `--auto-approve` flag — and even then, still produce all artifacts and update manifest

**Rationalization table — these are NOT valid reasons to skip:**

| Excuse | Why it's wrong |
|--------|---------------|
| "I already have context so I'll skip the manifest" | Manifest drives the dashboard and resume. Always create it. |
| "This is a simple task, stop-gates aren't needed" | Stop-gates exist for user control, not complexity. Always stop. |
| "I'll create the manifest later" | Later never comes. Create it FIRST. |
| "The user is in dangerous/auto mode" | Auto mode skips interactive prompts, not artifacts or manifest. |
| "I can see what needs to be done" | Seeing ≠ following the protocol. Execute initialization step by step. |

## Overview

You orchestrate the full SDLC workflow. You determine the workflow type, create the workspace, and drive phase-by-phase execution with user approval gates between each phase.

## Auto-Approve Mode

When the command includes `--auto-approve` (e.g., `/sdlc feature --auto-approve "description"`), run the entire workflow without any interactive stops:

- **Skip** workflow type confirmation — use detected/explicit type directly
- **Skip** git isolation question — use current branch
- **Skip** dashboard question — disable dashboard
- **Skip** all phase stop-gates — auto-approve each phase immediately after artifact is produced
- **Still produce** all artifacts and update manifest normally
- **Still follow** the full agent pipeline for implementation tasks

Parse and remove `--auto-approve` from the arguments before processing the description.

## Workflow Type Detection

### 1. Explicit
If the user specifies a type: `/sdlc feature "..."`, `/sdlc bugfix "..."`, `/sdlc refactor "..."`, `/sdlc spike "..."` → use that type.

### 2. Inferred
If the user runs `/sdlc "description"` without a type, analyze the description holistically (not keyword matching). Apply this priority when ambiguous:

1. Defect, error, broken behavior → `bugfix` (highest priority — fixing broken things comes first)
2. Restructuring existing working code → `refactor`
3. Research, evaluation, comparison without implementation intent → `spike`
4. Otherwise → `feature` (default)

### 3. Confirmed
Unless `--auto-approve` is set, always confirm the detected type before proceeding: _"This looks like a **{type}**. Correct?"_

## Phase Sequencing

| Workflow | Phases |
|----------|--------|
| Feature | clarify → research → design → plan → implement |
| Bugfix | clarify → research → design → plan → implement |
| Refactor | clarify → research → design → plan → implement |
| Spike | clarify → research → design → **DONE** |

## Initialization

When starting a new workflow:

### 1. Determine workflow type
Use detection logic above.

### 2. Generate slug
Create a short slug from the task description (e.g., "Add user notification preferences" → `notification-prefs`).

### 3. Ask about git isolation
Unless `--auto-approve` is set (use current branch):
> "Create isolated worktree or work on current branch?"

- **Worktree**: If `superpowers:using-git-worktrees` is available, invoke it. Otherwise, create a feature branch and git worktree manually.
- **Current branch**: Work directly on the current branch

### 4. Ask about HTML dashboard
Unless `--auto-approve` is set (skip dashboard):
> "Launch live HTML dashboard in browser? (Y/n)"

Default is **yes**. If user confirms (or doesn't respond / presses enter):
1. Generate `dashboard.html` in the workflow folder (see Dashboard section below)
2. Start a local HTTP server: `python -m http.server 8111 --directory {workflow-folder}`
3. Open in browser: `start http://localhost:8111/dashboard.html` (Windows) or `open` (Mac)

If user declines, skip — the console progress table (printed by Lead agent) is always active regardless.

### 5. Create workflow folder and manifest

Create the folder structure:
```
sdlc-doc/workflows/{type}/{YYYY-MM-DD}-{slug}/
  manifest.json
```

Create `manifest.json`:
```json
{
  "workflow_type": "{type}",
  "slug": "{slug}",
  "created": "{YYYY-MM-DD}",
  "current_phase": "clarify",
  "phases": {
    "clarify":   { "status": "pending" },
    "research":  { "status": "pending" },
    "design":    { "status": "pending" },
    "plan":      { "status": "pending" },
    "implement": { "status": "pending" }
  },
  "tasks": [],
  "dashboard": true,
  "task_description": "{description}",
  "isolation": "{worktree|current-branch}",
  "worktree_path": "{path if worktree}",
  "branch": "{branch name}"
}
```

For Spike workflows, omit `plan` and `implement` from the phases object.

The `tasks` array is populated at the Plan phase. Each entry:
```json
{
  "id": 1,
  "title": "{task title}",
  "status": "queue",
  "current_agent": null,
  "skills": { "primary": "{domain-skill}", "supplementary": [] },
  "agents": {
    "coder":       { "status": "pending", "bounces": 0 },
    "tester":      { "status": "pending", "bounces": 0 },
    "reviewer":    { "status": "pending", "bounces": 0 },
    "security":    { "status": "pending", "bounces": 0 },
    "rubber_duck": { "status": "pending", "bounces": 0 },
    "lead":        { "status": "pending", "bounces": 0 }
  },
  "retry_count": 0,
  "commit": null,
  "failed_agent": null,
  "failure_reason": null
}
```

Task `status` values: `queue` | `active` | `retry` | `approval` | `done` | `failed` | `skipped`
Agent `status` values: `pending` | `active` | `passed` | `failed` | `skipped`
`bounces` — integer, starts at 0, incremented each time that agent rejects. Never reset.

**Carry all six canonical agents on every task, even when one will not run** — a disabled
Rubber Duck, a Security pass the Lead skips on a task with no trust boundary. Set its status
to `skipped`; do **not** omit the key. An omitted key and a `skipped` status render
identically on the dashboard now (a neutral dot in the aligned slot), but the manifest is the
record of what was decided, and "skipped, on purpose" is a decision worth keeping. Never
leave an agent at `active` after it returns — advance it to `passed`/`failed`/`skipped`, or a
closed task will read as still having work in flight.

When a task exhausts retries (3 cycles), set task `status` to `failed`, record `failed_agent` (which agent couldn't pass) and `failure_reason` (last error/feedback from that agent).

The Lead agent updates `manifest.json` **before and after every agent dispatch** so the dashboard stays in sync.

### 6. Run the first phase

**CHECKPOINT:** Before proceeding, verify `manifest.json` exists on disk and contains valid JSON with the correct workflow type, slug, and phase structure. If it doesn't exist, you skipped step 5 — go back and create it NOW.

Load `references/clarify.md` and follow its instructions, passing the workflow type and manifest path as context.

## Phase Execution

This skill consolidates all five phases. Phase-specific instructions live in `references/`:

| Phase | Reference file | Artifact | Runs in |
|-------|----------------|----------|---------|
| Clarify   | `references/clarify.md`   | `00-clarify.md` | this window — it is a conversation |
| Research  | `references/research.md`  | `01-research.md` | a sub-agent |
| Design    | `references/design.md`    | `02-design/` | a sub-agent to produce; stop-gate here |
| Plan      | `references/plan.md`      | `03-plan.md` | a sub-agent |
| Implement | `references/implement.md` | `04-implementation-log.md` | per-task agent pipeline |

Delegation rules and the dispatch contract: [references/dispatch.md](references/dispatch.md).

**How to run a phase:**
1. Set the phase `in_progress` in `manifest.json`
2. **Decide whether to delegate** — see [dispatch.md](references/dispatch.md). Research and Plan run entirely in a sub-agent; Design delegates production only; Clarify never delegates, because it is a conversation with the user and a sub-agent cannot have one
3. **Delegated**: dispatch with the workflow folder path and the phase reference file, and receive a stop-gate summary back. **Inline**: read `references/<phase>.md` and follow it here
4. Update `manifest.json` — the orchestrator is its only writer, delegated or not
5. Present the summary at the stop-gate (skip if `--auto-approve`)
6. On approval, transition to the next phase (see "Phase Transition" below)

Delegation is what keeps the later phases from reasoning on the residue of the earlier
ones: the artifact on disk is the handoff, and only a paragraph returns to this window.
Pass the sub-agent **paths, never file contents** — reading an artifact here in order to
hand it over spends exactly the context the delegation was meant to save.

The references share the canonical SDLC vocabulary (workflow type, manifest schema, artifact paths) defined in this SKILL.md — they do not redefine these contracts.

## Phase Transition

After a phase is approved (by the user, or automatically if `--auto-approve`):
1. Update manifest: set current phase status to `approved` with `completed_at` timestamp
2. Advance `current_phase` to the next phase
3. Set next phase status to `in_progress`
4. Load `references/<next-phase>.md` from this skill and follow its instructions — do NOT invoke a separate phase skill (all phases live in this unified `sdlc` skill under `references/`)

## Resume Mode

When invoked with `mode=resume`:
1. Scan all `manifest.json` files under `sdlc-doc/workflows/`
2. Filter to workflows that are **not complete** (any phase without status `approved`)
3. If **one** incomplete workflow found — resume it automatically
4. If **multiple** incomplete workflows found — list them and ask the user which one to resume (unless `--auto-approve` is set, in which case pick the most recent)
5. If a user-specified path is provided, use that directly (skip scanning)
6. If a phase argument is provided, resume from that phase
7. If no phase specified, resume from `manifest.current_phase`
8. Re-read all prior artifacts (they may have been manually edited between sessions)
9. If artifacts were edited since the phase that produced them, note at stop-gate
10. Restore worktree context if `isolation: "worktree"` and the worktree still exists
11. If no active workflow found, tell the user and suggest `/sdlc` to start a new one

## Single-Phase Mode

When invoked with a specific phase (e.g., `phase=research`):
1. Scan `sdlc-doc/workflows/` for incomplete workflows (same logic as Resume Mode steps 1-5)
2. If found, run only that phase within the existing workflow
3. If no active workflow, create a new one with the phase as the starting point
4. Apply artifact gating — check that prerequisite artifacts exist (warn if missing, don't block)

## Spike Completion

When a Spike workflow completes the Design phase, present a completion message:

```
⏸ Spike Complete: {slug}
─────────────────────────────────
Summary: [2-3 sentence overview of findings and recommendation]

Artifacts produced:
  - 02-design/options-analysis.md — [one-line description]
  - 02-design/recommendation.md — [one-line description]

This spike is complete. No implementation phase.
You can use these findings as input to a future /sdlc feature or /sdlc refactor.
─────────────────────────────────
```

Do NOT advance to Plan or Implement.

## Dashboard

When `dashboard` is `true` in the manifest, generate a self-contained `dashboard.html` in the workflow folder during initialization (step 4).

### Requirements
- **Zero dependencies** — single HTML file with embedded CSS and JS
- **Polls `manifest.json`** every 2 seconds via `fetch('./manifest.json')`
- **Kanban layout** with three columns: Queue, Active, Done
- **Task cards** show: task number, title, current agent, primary + supplementary skills, retry count, and commit hash once closed
- **Active card** pulses or highlights to show which agent is running
- **Six canonical agent slots per card, always drawn** in dispatch order — C·T·R·S·D·L — so the Lead dot sits in the same position on every card; a role the manifest omits or marks `skipped` renders a neutral dot rather than collapsing the row
- **Closed tasks are clamped** — a `done`/`failed`/`skipped` task never shows an agent as `active` (spinning). Clamp `active`→`passed` and `pending`→`skipped` in the display
- **Segmented progress bar** at top: done (green) · active (blue) · retry (amber) · failed (red), so intermediate states are visible, not just queue↔done
- **Progress counts only truly-`done` tasks** — a failed or skipped task must not read as completion
- **Done column separates outcomes** — the count badge is truly-`done` only, with `N failed · M skipped` shown as a distinct breakdown so a failure never sits silently under the word "Done"
- **Auto-updates** — cards move between columns as `manifest.json` updates

### Kanban Card Content
```
┌──────────────────────────┐
│ Task {id}: {title}       │
│ Agent: {current_agent}   │
│ Skills: {primary}        │
│   + {supplementary}      │
│ ┌─C──T──R──S──D──L─┐     │
│ │ ✅  ⚙  ○  ○  ○  ○ │     │
│ └───────────────────┘     │
└──────────────────────────┘
C=Coder T=Tester R=Reviewer S=Security D=Rubber Duck L=Lead(compliance)
```

Every agent that can bounce a task must appear here and in the manifest's `agents` object,
in dispatch order. An agent that runs and rejects but has no dot leaves the card showing an
active task with no visible cause — which is what happened to Rubber Duck. **Draw all six
canonical slots unconditionally.** A role the manifest omits or marks `skipped` (Security
when the Lead skips it, Rubber Duck when disabled) renders a **neutral dot in its slot**, not
nothing — dropping it shifts every later dot leftward and the Lead dot lands in a different
place on every card. The dashboard must be robust to an imperfect manifest: it draws the six
columns from the canonical list, not from whichever keys happen to be present, and clamps a
closed task's agents so a finished card never shows a spinning gear.

### Local server
Start with: `python -m http.server 8111 --directory {workflow-folder}` (run in background).
Open: `start http://localhost:8111/dashboard.html` (Windows) or `open` (Mac/Linux).

The server runs for the duration of the workflow. The Lead agent does NOT need to manage it — it reads `manifest.json` from disk, the server just serves static files.
