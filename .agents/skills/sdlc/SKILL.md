---
name: sdlc
description: "SDLC workflow orchestrator — routes /sdlc commands to the correct workflow type (feature, bugfix, refactor, spike) and phase (clarify, research, design, plan, implement). Manages manifests, artifact folders, git isolation, and phase transitions."
---

# SDLC Master Orchestrator

## Overview

You orchestrate the full SDLC workflow. You determine the workflow type, create the workspace, and drive phase-by-phase execution with user approval gates between each phase.

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
Always confirm the detected type before proceeding: _"This looks like a **{type}**. Correct?"_

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
> "Create isolated worktree or work on current branch?"

- **Worktree**: If `superpowers:using-git-worktrees` is available, invoke it. Otherwise, create a feature branch and git worktree manually.
- **Current branch**: Work directly on the current branch

### 4. Ask about HTML dashboard
> "Launch live HTML dashboard in browser? (Y/n)"

Default is **yes**. If user confirms (or doesn't respond / presses enter):
1. Generate `dashboard.html` in the workflow folder (see Dashboard section below)
2. Start a local HTTP server: `python -m http.server 8111 --directory {workflow-folder}`
3. Open in browser: `start http://localhost:8111/dashboard.html` (Windows) or `open` (Mac)

If user declines, skip — the console progress table (printed by Lead agent) is always active regardless.

### 5. Create workflow folder and manifest

Create the folder structure:
```
docs/workflows/{type}/{YYYY-MM-DD}-{slug}/
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
    "coder":    { "status": "pending" },
    "tester":   { "status": "pending" },
    "reviewer": { "status": "pending" },
    "security": { "status": "pending" },
    "compliance": { "status": "pending" }
  },
  "retry_count": 0,
  "commit": null,
  "failed_agent": null,
  "failure_reason": null
}
```

Task `status` values: `queue` | `active` | `retry` | `approval` | `done` | `failed` | `skipped`
Agent `status` values: `pending` | `active` | `passed` | `failed` | `skipped`

When a task exhausts retries (3 cycles), set task `status` to `failed`, record `failed_agent` (which agent couldn't pass) and `failure_reason` (last error/feedback from that agent).

The Lead agent updates `manifest.json` **before and after every agent dispatch** so the dashboard stays in sync.

### 6. Delegate to first phase
Invoke the `sdlc-clarify` skill with the workflow type and manifest path.

## Phase Delegation

Invoke the phase-specific skill for the current phase:

| Phase | Skill to invoke |
|-------|----------------|
| Clarify | `sdlc-clarify` |
| Research | `sdlc-research` |
| Design | `sdlc-design` |
| Plan | `sdlc-plan` |
| Implement | `sdlc-implement` |

Pass the workflow type and manifest path to each phase skill.

## Phase Transition

After a phase is approved by the user:
1. Update manifest: set current phase status to `approved` with `completed_at` timestamp
2. Advance `current_phase` to the next phase
3. Set next phase status to `in_progress`
4. Invoke the next phase skill

## Resume Mode

When invoked with `mode=resume`:
1. Read `manifest.json` from the most recent workflow folder in `docs/workflows/` (or user-specified path)
2. If a phase argument is provided, resume from that phase
3. If no phase specified, resume from `manifest.current_phase`
4. Re-read all prior artifacts (they may have been manually edited between sessions)
5. If artifacts were edited since the phase that produced them, note at stop-gate
6. Restore worktree context if `isolation: "worktree"` and the worktree still exists
7. If no active workflow found, tell the user and suggest `/sdlc` to start a new one

## Single-Phase Mode

When invoked with a specific phase (e.g., `phase=research`):
1. Look for an active workflow in `docs/workflows/` (most recent manifest)
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
- **Task cards** show: task number, title, current agent, primary + supplementary skills, retry count
- **Active card** pulses or highlights to show which agent is running
- **Progress bar** at top showing overall completion (done / total)
- **Auto-updates** — cards move between columns as `manifest.json` updates

### Kanban Card Content
```
┌──────────────────────────┐
│ Task {id}: {title}       │
│ Agent: {current_agent}   │
│ Skills: {primary}        │
│   + {supplementary}      │
│ ┌─C──T──R──S──L─┐       │
│ │ ✅  ⚙  ○  ○  ○ │       │
│ └────────────────┘       │
└──────────────────────────┘
C=Coder T=Tester R=Reviewer S=Security L=Lead(compliance)
```

### Local server
Start with: `python -m http.server 8111 --directory {workflow-folder}` (run in background).
Open: `start http://localhost:8111/dashboard.html` (Windows) or `open` (Mac/Linux).

The server runs for the duration of the workflow. The Lead agent does NOT need to manage it — it reads `manifest.json` from disk, the server just serves static files.
