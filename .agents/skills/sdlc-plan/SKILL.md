---
name: sdlc-plan
description: "SDLC plan phase — produces 03-plan.md with task breakdown. Each task specifies domain skill, dependencies, and acceptance criteria. Structure varies by workflow type: architectural layers (feature), fix + regression (bugfix), migration steps (refactor)."
---

# SDLC Plan Phase

## Purpose

Break the design into discrete, implementable tasks. Each task specifies exactly one domain skill, its dependencies, and clear acceptance criteria. This plan becomes the contract for the Implementation phase.

## Artifact Gating

**Requires**: `02-design/` folder with artifacts

If missing, present warning with options to run design first, proceed anyway, or abort.

## Workflow-Specific Plan Structure

### Feature
Break tasks by **architectural layer** (bottom-up):
1. Domain layer (entities, value objects, domain logic)
2. Interface layer (services, use cases, contracts)
3. Adapter layer (controllers, repositories, external integrations)
4. Cross-cutting (validation schemas, error handling, configuration)

### Bugfix
Minimal scope — typically 2 tasks:
1. Fix task — apply the fix from `fix-strategy.md`
2. Regression test task — implement tests from `regression-test-plan.md`

### Refactor
Follow the **migration path** from `migration-path.md`:
- Each migration step becomes a task
- Each task has a rollback point
- Order matters — no skipping steps

### Spike
Should NOT reach this phase. If invoked for a Spike, respond:
> "Spike workflows end at the Design phase. The recommendation has already been produced."

## Task Format

Each task in `03-plan.md` must follow this format:

```markdown
### Task {N}: {title}
- **Domain skill**: {backend-node | frontend-angular | backend-csharp | devops | architect}
- **Depends on**: {Task N | none}
- **Acceptance criteria**:
  - {criterion 1}
  - {criterion 2}
  - {criterion 3}
- **Design artifacts to read**:
  - {02-design/artifact.md}
- **Notes**: {any additional context for the Coder agent}
```

## Security Agent Decision (Refactor only)

For Refactor workflows, decide whether the Security agent should be activated:

- **Activate** if the refactor touches: authentication/authorization, API boundaries, data access patterns, input validation, secrets handling
- **Skip** if purely structural: renaming, extracting, reorganizing, updating imports

State the decision and rationale in the plan and at the stop-gate. User can override.

## Multi-Domain Workflows

A single workflow may span multiple domains (e.g., "Angular frontend + Node API"). Each task specifies its own domain skill independently. The domain_skill is per-task, not per-workflow.

## Dependency Analysis

Every task MUST declare its dependencies explicitly. Follow these rules:

1. **Analyze data flow** — if Task B uses a type, service, or API endpoint created by Task A, then Task B depends on Task A
2. **Analyze import chains** — if Task B imports a module created by Task A, declare the dependency
3. **Domain layer first** — domain entities/models have no dependencies; services depend on domain; adapters depend on services
4. **Mark independent tasks** — tasks with `Depends on: none` can run in parallel when using Agent Teams
5. **No circular dependencies** — if you find a cycle, merge the tasks or restructure

### Dependency Notation

In the Task Summary table, use explicit references:

| Task | Title | Domain Skill | Depends On | Can Parallel? |
|------|-------|-------------|------------|:------------:|
| 1 | Create domain entities | backend-node | — | — |
| 2 | Create repository layer | backend-node | Task 1 | No |
| 3 | Create service layer | backend-node | Task 2 | No |
| 4 | Add API validation schemas | backend-node | Task 1 | Yes (with 2,3) |
| 5 | Create Angular component | frontend-angular | Task 3 | No |

### Dependency Validation Checklist

Before finalizing the plan, verify:
- [ ] No task references a file/type/service created by a later task
- [ ] Independent tasks are correctly marked (no false dependencies)
- [ ] The critical path (longest dependency chain) is identified
- [ ] Domain layer tasks come before interface/adapter tasks

## How to Work

1. Read all artifacts in `02-design/` to understand the full design
2. Read `00-clarify.md` for success criteria
3. Decompose into tasks following the workflow-specific structure
4. Assign one domain skill per task
5. Define clear acceptance criteria per task (testable, specific)
6. **Analyze dependencies between tasks** — data flow, imports, layer ordering
7. **Identify which tasks can run in parallel** (independent tasks)
8. Produce `03-plan.md`

## Output Artifact

Write `03-plan.md` to the workflow folder:

```markdown
# Implementation Plan

## Overview
{1-2 sentences describing what will be implemented}

## Task Summary
| Task | Title | Domain Skill | Depends On | Can Parallel? |
|------|-------|-------------|------------|:------------:|
| 1 | {title} | {skill} | — | — |
| 2 | {title} | {skill} | Task 1 | No |

## Security Agent
{Activated / Skipped — rationale (Refactor only)}

---

### Task 1: {title}
{full task specification}

### Task 2: {title}
{full task specification}
```

## Manifest Update

- Set plan phase status to `in_progress` when starting
- Set to `approved` with `completed_at` after user approves

## Stop-Gate

If `--auto-approve` is active, skip this gate — proceed immediately to the next phase.

Otherwise, present the stop-gate with task summary table, total task count, and Security activation decision (for Refactor).
