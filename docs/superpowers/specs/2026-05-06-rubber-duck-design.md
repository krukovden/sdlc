# Design: Rubber Duck Cross-Model Review

**Date:** 2026-05-06  
**Status:** Approved  
**Inspired by:** [GitHub Copilot CLI: Rubber Duck feature](https://github.blog/ai-and-ml/github-copilot/github-copilot-cli-combines-model-families-for-a-second-opinion/)

---

## Problem

All SDLC agents currently run on the same model (claude-sonnet-4-6). A model reviewing its own work remains bounded by its own training biases and blind spots. Reviewer and Security agents may share the same failure modes as the Coder they are reviewing.

---

## Solution

Add an **additive Rubber Duck agent** — a second-opinion reviewer that always runs on a **different model** than the primary agents. It runs after Reviewer and Security both pass, sees their full output, and looks specifically for what they missed.

---

## Architecture

### Updated Pipeline

**Feature / Bugfix:**
```
Coder → Tester → Reviewer (primary model) → Security (primary model) → Rubber Duck (opposite model) → Lead compliance
```

**Refactor:**
```
Coder → Tester → Reviewer (primary model) → [Security if activated] → [Rubber Duck if enabled] → Lead compliance
```

Rubber Duck is **additive** — it does not replace Reviewer or Security. It is skipped when `rubber_duck.enabled: false`.

### Platform-Aware Model Selection

Lead auto-selects the Rubber Duck model based on environment — always the opposite of the primary:

| Environment | Primary agents | Rubber Duck |
|-------------|---------------|-------------|
| Claude Code | Sonnet (default) | claude-opus-4-7 |
| Claude Code | Opus | claude-sonnet-4-6 |
| Copilot CLI | Claude (any) | GPT-5.4 (best available GPT) |
| Copilot CLI | GPT (any) | claude-opus-4-7 |

If Copilot CLI does not expose the current primary provider, Lead defaults to GPT-5.4 as Rubber Duck.

### Dispatch Mode Detection (updated priority)

```
1. TeamCreate tool available    → Agent Teams (Claude Code, parallel)
2. gh copilot fleet available   → Copilot Fleet (parallel)
3. Neither                      → Sequential subagents (fallback)
```

In Fleet mode, independent tasks run in parallel — each fleet worker executes the full pipeline for its task including Rubber Duck. Dependent tasks wait for their dependencies, same as Team Mode.

---

## Components

### New: `.agents/agents/sdlc-rubber-duck.md`

**Role:** Independent second-opinion reviewer. Intentionally runs on a different model than primary agents.

**Inputs:**
- Full pipeline context (code, tests, Reviewer results, Security results)
- Task description from `03-plan.md`
- Domain skill (same as Coder)

**Focus — what Reviewer and Security do not explicitly cover:**
- Hidden assumptions in logic that seem obvious to the primary model
- Edge cases dismissed as "not needed now"
- Cross-file issues within the task scope
- Whether acceptance criteria are actually met (not just that tests pass)
- Conflicts with prior architectural decisions

**Verdict rules:** Same as Reviewer — `PASS | NEEDS CHANGES | FAIL`, same blocking behavior, max 3 retry cycles with Coder. This retry budget is independent from Reviewer's and Security's retry budgets.

**Autonomous mode:** After PASS, returns pipeline context to Lead. After NEEDS CHANGES, spawns Coder for retry fix, then re-reviews.

**Key constraint:** Rubber Duck receives Reviewer and Security results as context. It does not repeat their work — it looks at what remains unchecked after them.

### Modified: `.agents/agents/sdlc-lead.md`

**Skill Resolution:** Add Rubber Duck to dispatch sequence when `rubber_duck.enabled: true` for the task.

**Fleet detection:** Add Copilot Fleet as dispatch mode option 2 (between TeamCreate and sequential fallback).

**Rubber Duck model selection:** Add platform detection logic — determine primary model/provider, select the complementary model for Rubber Duck.

### Modified: `.agents/agents/sdlc-security.md`

**Autonomous mode:** After PASS, spawn Rubber Duck agent instead of returning directly to Lead (when task has `rubber_duck.enabled: true`).

### Modified: `.agents/skills/sdlc-implement/SKILL.md`

**Dispatch Mode Detection:** Add Copilot Fleet as option 2.

**Pipeline sequence:** Add Rubber Duck step after Security.

**Autonomous pipeline:** Update chain — Security spawns Rubber Duck, Rubber Duck returns completed context to Lead.

**Implementation log:** Add `Rubber Duck` field to each task entry.

### Modified: `.agents/skills/sdlc-plan/SKILL.md`

Lead evaluates each task during Plan phase and sets `rubber_duck` field:

**Enablement heuristics:**

| Task characteristic | `enabled` |
|--------------------|-----------|
| Touches auth, payments, PII, API boundaries | `true` |
| Multi-file, complex logic | `true` |
| Simple CRUD, config changes | `false` |
| Trivial changes (rename, docs, comments) | `false` |

**Task format addition in `03-plan.md`:**
```markdown
## Task 1: Implement JWT refresh flow
- skill: backend-node
- rubber_duck:
    enabled: true
    rationale: "Auth flow — cross-model review warranted"
```

---

## Plan Stop-Gate Addition

The Plan phase stop-gate gains a Rubber Duck section:

```
⏸ Phase Complete: Plan
─────────────────────────────────
...existing content...

Rubber Duck Configuration:
  Task 1: ✅ enabled — Auth flow — cross-model review warranted
  Task 2: ✗  disabled — Simple passthrough, no critical logic
  Task 3: ✅ enabled — Multi-file payments integration

To override: rubber_duck on|off <task-number>
─────────────────────────────────
→ approve
```

User sees and can adjust the configuration before approving the plan.

---

## Implementation Log Update

Each task entry gains a `Rubber Duck` field:

```markdown
## Task 1: Implement JWT refresh flow
- **Rubber Duck**: PASS (claude-opus-4-7) — no additional concerns
```

Or when issues were found:
```markdown
- **Rubber Duck**: PASS after 1 retry — found unhandled token expiry race condition
```

---

## Files Changed Summary

| File | Change type |
|------|------------|
| `.agents/agents/sdlc-rubber-duck.md` | New |
| `.agents/agents/sdlc-lead.md` | Modified — Fleet detection, Rubber Duck dispatch, model selection |
| `.agents/agents/sdlc-security.md` | Modified — autonomous mode spawns Rubber Duck |
| `.agents/skills/sdlc-implement/SKILL.md` | Modified — Fleet detection, Rubber Duck in pipeline |
| `.agents/skills/sdlc-plan/SKILL.md` | Modified — Rubber Duck enablement heuristics and task format |

---

## Out of Scope

- Rubber Duck for Tester agent (Tester's job is mechanical — run tests — not judgment-based)
- Per-task model override by user in `03-plan.md` (Lead auto-selects; user can only toggle enabled/disabled)
- MCP server for true cross-family review in Claude Code (Claude-only environment uses Sonnet ↔ Opus)
