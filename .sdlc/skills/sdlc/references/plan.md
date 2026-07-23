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
- **Mode**: {autonomous | mediated (reason)}
- **Rubber Duck**: {enabled — rationale | disabled — rationale}
- **Depends on**: {Task N | none}
- **Acceptance criteria**:
  - {criterion 1}
  - {criterion 2}
  - {criterion 3}
- **Design artifacts to read**:
  - {02-design/artifact.md}
- **Notes**: {any additional context for the Coder agent}
```

## Acceptance Criteria Must Be Executable, Not Aspirational

A criterion is "testable" only if someone has already seen it run against **this**
repository. The most common way a plan corrupts a phase is by asserting a green baseline
that was never checked — three separate "the command passes" criteria that are all false at
the branch point, each discovered only when a Coder finally runs it and loses the task's real
diff in the fallout.

**Consume the Research phase's Verified Command Baseline.** `01-research.md` carries a
`Verified Command Baseline` table — the exact working invocations, the branch-point result
for anything not green, and the commands that must not be run as-written. Every command you
put in an acceptance criterion must come from that table. Concretely:

- **Never write a bare "`{command}` passes"** for a command that is not green at the branch
  point. If the baseline shows 155 pre-existing `tsc` errors or a suite that is 13/14, the
  criterion is *"no new failures vs the branch-point baseline for the same pattern"*, with
  the baseline number quoted.
- **Use the invocation and flags the baseline verified**, not the ones you remember — tool
  versions rename flags (a renamed path-filter flag is a hard error, not a test run).
- **Do not write a command the baseline marks "must not run as-written"** into a criterion:
  a repo-wide `lint --fix` reformats unrelated files and buries the task's change; a
  Windows-only `prebuild` fails on macOS. Use the substitute the baseline names.
- **Coverage globs are relative to the test runner's `rootDir`** (recorded in the baseline).
  A glob rooted at the repo when `rootDir` is `src/` matches zero files and reports a
  green-looking 0%. Give the glob relative to `rootDir`, or run plain `--coverage` and grep.

If Research produced no baseline (older workflow, or it was skipped), run the handful of
candidate commands once yourself before finalizing — it is cheap and it is the difference
between a criterion someone has seen run and a guess.

**Transcribe target-repo gotchas into the plan preamble.** Read the target repo's
`CLAUDE.md` / `AGENTS.md` gotcha sections; any platform-specific command substitution they
document goes into the plan's Overview so every task inherits it.

**Quote the source, not the count.** When a criterion refers to a set — "all the constants
from `api-contracts.md` §1.2" — cite the *source section*, not a number. A number ("all
eleven constants") drifts from the design the moment the design gains a twelfth, and a Coder
optimising for the stated count will drop the extras. If you must state a count, verify it
against the design artifact you cite.

## Rubber Duck Evaluation

For every task, evaluate whether Rubber Duck should be enabled and set `rubber_duck` accordingly.

**Enable when ANY of these apply:**
- Task touches authentication, authorization, payments, or PII
- Task crosses service boundaries (frontend ↔ backend, service ↔ external)
- Task has 3+ files changed or complex multi-step logic
- Task modifies shared infrastructure, CI/CD, or data models

**Disable when ALL of these apply:**
- Simple CRUD, config changes, or documentation
- Single-file changes with no side effects
- Trivial refactors (rename, extract, reorganize)

State the rationale for each decision. The user can override at the plan stop-gate.

## Security Agent Decision (Refactor only)

For Refactor workflows, decide whether the Security agent should be activated:

- **Activate** if the refactor touches: authentication/authorization, API boundaries, data access patterns, input validation, secrets handling
- **Skip** if purely structural: renaming, extracting, reorganizing, updating imports

State the decision and rationale in the plan and at the stop-gate. User can override.

## Multi-Domain Workflows

A single workflow may span multiple domains (e.g., "Angular frontend + Node API"). Each task specifies its own domain skill independently. The domain_skill is per-task, not per-workflow.

## Execution Mode Assignment

Each task must be assigned an execution mode:

- **`autonomous`** (default) — agents chain directly (Coder → Tester → Reviewer → Security) without Lead mediating each handoff. Lead dispatches once and reviews the final result.
- **`mediated`** — Lead mediates every agent handoff (current behavior). Use for high-risk tasks.

### Risk criteria for `mediated`

Assign `mediated` when ANY of these apply:

- Task touches authentication or authorization logic
- Task crosses service boundaries (frontend ↔ backend, service ↔ service)
- Task modifies shared infrastructure, CI/CD pipelines, or deployment config
- Task changes data models that require migrations
- Task modifies security-sensitive code (encryption, secrets handling, input validation at trust boundaries)

All other tasks default to `autonomous`. State the reason when assigning `mediated` (e.g., `mediated (touches auth)`).

The user can override any task's mode at the plan approval gate.

## Dependency Analysis

Every task MUST declare its dependencies explicitly. Follow these rules:

1. **Analyze data flow** — if Task B uses a type, service, or API endpoint created by Task A, then Task B depends on Task A
2. **Analyze import chains** — if Task B imports a module created by Task A, declare the dependency
3. **Domain layer first** — domain entities/models have no dependencies; services depend on domain; adapters depend on services
4. **Mark independent tasks** — tasks with `Depends on: none` can run in parallel when using Agent Teams
5. **No circular dependencies** — if you find a cycle, merge the tasks or restructure

### Dependency Notation

In the Task Summary table, use explicit references:

| Task | Title | Domain Skill | Mode | Rubber Duck | Depends On | Can Parallel? |
|------|-------|-------------|------|:-----------:|------------|:------------:|
| 1 | Create domain entities | backend-node | autonomous | ✗ | — | — |
| 2 | Create repository layer | backend-node | autonomous | ✗ | Task 1 | No |
| 3 | Create service layer | backend-node | autonomous | ✓ | Task 2 | No |
| 4 | Add API validation schemas | backend-node | autonomous | ✗ | Task 1 | Yes (with 2,3) |
| 5 | Create Angular component | frontend-angular | autonomous | ✓ | Task 3 | No |

### Dependency Validation Checklist

Before finalizing the plan, verify:
- [ ] No task references a file/type/service created by a later task
- [ ] Independent tasks are correctly marked (no false dependencies)
- [ ] The critical path (longest dependency chain) is identified
- [ ] Domain layer tasks come before interface/adapter tasks

## How to Work

1. Read all artifacts in `02-design/` to understand the full design
2. Read `00-clarify.md` for success criteria, and `01-research.md`'s **Verified Command
   Baseline** — it is the source for every command an acceptance criterion may name
3. Decompose into tasks following the workflow-specific structure
4. Assign one domain skill per task
5. Define clear acceptance criteria per task — testable and specific means **executable
   against this repo**: see "Acceptance Criteria Must Be Executable" above
6. **Analyze dependencies between tasks** — data flow, imports, layer ordering
7. **Identify which tasks can run in parallel** (independent tasks)
8. **Evaluate Rubber Duck** for each task using the heuristics above
9. Produce `03-plan.md`

## Output Artifact

Write `03-plan.md` to the workflow folder:

```markdown
# Implementation Plan

## Overview
{1-2 sentences describing what will be implemented}

## Task Summary
| Task | Title | Domain Skill | Mode | Rubber Duck | Depends On | Can Parallel? |
|------|-------|-------------|------|:-----------:|------------|:------------:|
| 1 | {title} | {skill} | {mode} | ✗ | — | — |
| 2 | {title} | {skill} | {mode} | ✓ | Task 1 | No |

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

Otherwise, present the stop-gate with task summary table, total task count, Security activation decision (Refactor only), and Rubber Duck configuration:

```
Rubber Duck Configuration:
  Task 1: ✗ disabled — {rationale}
  Task 2: ✓ enabled  — {rationale}

To override: rubber_duck on|off <task-number>
```

The user can toggle any task's Rubber Duck setting before approving.
