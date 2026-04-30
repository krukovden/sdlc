# Bugfix Workflow

## Overview

The Bugfix workflow is a focused pipeline for diagnosing and fixing defects. It shares the same five phases as Feature but with artifacts tailored to root cause analysis, blast radius assessment, and regression prevention. Security agent is always active since bugs can mask or introduce vulnerabilities.

**Trigger:** `/sdlc bugfix "description"` or inferred when the description indicates a defect, error, or broken behavior.

## Phases

| # | Phase | Agent | Gate | Description |
|---|-------|-------|------|-------------|
| 1 | **Clarify** | Lead | User approval | Gather reproduction steps, error details, and impact assessment |
| 2 | **Research** | Lead | User approval | Trace failure path, identify affected components, find similar patterns |
| 3 | **Design** | Lead | User approval | Document root cause, fix strategy, blast radius, and regression plan |
| 4 | **Plan** | Lead | User approval | Define fix task(s) and regression test tasks (minimal scope) |
| 5 | **Implement** | All 5 agents | User approval per task | Execute fix and regression tests through the full agent pipeline |

### Clarify Focus Areas

- **Reproduction steps** -- exact sequence to trigger the bug
- **Error details** -- error messages, stack traces, logs, screenshots
- **Impact** -- who is affected, severity, frequency, workarounds

### Research Focus Areas

- Failure trace through the codebase
- Affected components and their dependencies
- Similar bug patterns (historical or structural)

### Plan Strategy

Bugfix plans are minimal in scope:
1. **Fix task** -- the actual code change to resolve the root cause
2. **Regression test task** -- tests that prevent this bug from recurring

Avoid scope creep. If the investigation reveals broader issues, recommend a follow-up refactor workflow.

## Artifacts

### Phase Outputs

| Phase | Artifact | Path |
|-------|----------|------|
| Clarify | Clarification document | `00-clarify.md` |
| Research | Research findings | `01-research.md` |
| Design | Root cause analysis | `02-design/root-cause.md` |
| Design | Fix strategy | `02-design/fix-strategy.md` |
| Design | Blast radius assessment | `02-design/blast-radius.md` |
| Design | Regression test plan | `02-design/regression-test-plan.md` |
| Design | Standard verifications | `02-design/standard-verifications.md` |
| Plan | Implementation plan | `03-plan.md` |
| Implement | Implementation log | `04-implementation-log.md` |

### Artifact Consumers

| Artifact | Consumed By |
|----------|-------------|
| `root-cause.md` | Coder, Lead (compliance) |
| `fix-strategy.md` | Coder, Lead (compliance) |
| `blast-radius.md` | Tester, Reviewer, Lead (compliance) |
| `regression-test-plan.md` | Tester |
| `standard-verifications.md` | Reviewer |

## Agent Activation

All five agents are activated for every implementation task.

| Agent | Activation | Role |
|-------|------------|------|
| **Lead** | Always | Orchestrates task dispatch, performs design compliance check |
| **Coder** | Always | Implements the fix according to fix strategy |
| **Tester** | Always | Writes regression tests per regression test plan |
| **Reviewer** | Always | Reviews fix quality against standard verifications |
| **Security** | Always | Scans fix for security issues (bugs can mask vulnerabilities) |

### Agent Pipeline Per Task

```
Lead (dispatch) -> Coder -> Tester -> Reviewer -> Security -> Lead (compliance) -> Commit
```

Each agent-to-agent handoff has a retry loop (max 3 cycles). If an agent fails, Coder fixes and the failing agent re-evaluates.

## Folder Structure

```
sdlc-doc/workflows/bugfix/{YYYY-MM-DD}-{slug}/
  manifest.json
  00-clarify.md
  01-research.md
  02-design/
    root-cause.md
    fix-strategy.md
    blast-radius.md
    regression-test-plan.md
    standard-verifications.md
  03-plan.md
  04-implementation-log.md
  dashboard.html              (optional, if dashboard enabled)
```
