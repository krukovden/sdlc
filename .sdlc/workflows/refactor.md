# Refactor Workflow

## Overview

The Refactor workflow is for restructuring existing working code to improve its design, maintainability, or performance without changing external behavior. It follows all five phases with artifacts focused on migration planning and before/after comparison. The Security agent is optional -- the Lead decides based on refactoring scope.

**Trigger:** `/sdlc refactor "description"` or inferred when the description indicates restructuring existing working code.

## Phases

| # | Phase | Agent | Gate | Description |
|---|-------|-------|------|-------------|
| 1 | **Clarify** | Lead | User approval | Understand what is wrong with current code, desired outcome, and risk tolerance |
| 2 | **Research** | Lead | User approval | Map dependencies, analyze coupling, identify risk areas |
| 3 | **Design** | Lead | User approval | Define target architecture, migration path, and before/after comparison |
| 4 | **Plan** | Lead | User approval | Define migration steps with rollback points |
| 5 | **Implement** | 4-5 agents | User approval per task | Execute migration steps through the agent pipeline |

### Clarify Focus Areas

- **What's wrong** -- specific code smells, structural problems, or performance issues
- **Desired outcome** -- what the code should look like after refactoring
- **Risk tolerance** -- how aggressive the refactoring can be, what must remain stable

### Research Focus Areas

- Dependency map of affected modules
- Coupling analysis between components
- Risk areas where changes could break behavior

### Plan Strategy

Migration steps are ordered to maintain a working system at each step:
1. Each step has a defined **rollback point** -- a safe state to revert to if something breaks
2. Steps proceed from lowest-risk to highest-risk
3. Each step should be independently committable and testable

## Artifacts

### Phase Outputs

| Phase | Artifact | Path |
|-------|----------|------|
| Clarify | Clarification document | `00-clarify.md` |
| Research | Research findings | `01-research.md` |
| Design | Target architecture | `02-design/target-architecture.md` |
| Design | Migration path | `02-design/migration-path.md` |
| Design | Before/after comparison | `02-design/before-after.md` |
| Design | Testing strategy | `02-design/testing-strategy.md` |
| Design | Standard verifications | `02-design/standard-verifications.md` |
| Plan | Implementation plan | `03-plan.md` |
| Implement | Implementation log | `04-implementation-log.md` |

### Artifact Consumers

| Artifact | Consumed By |
|----------|-------------|
| `target-architecture.md` | Coder, Lead (compliance) |
| `migration-path.md` | Coder, Lead (compliance) |
| `before-after.md` | Reviewer, Lead (compliance) |
| `testing-strategy.md` | Tester |
| `standard-verifications.md` | Reviewer |

## Agent Activation

Security agent activation is decided by the Lead based on refactoring scope.

| Agent | Activation | Role |
|-------|------------|------|
| **Lead** | Always | Orchestrates task dispatch, decides Security activation, performs compliance check |
| **Coder** | Always | Implements migration steps according to migration path |
| **Tester** | Always | Writes tests to verify behavior is preserved |
| **Reviewer** | Always | Reviews code quality and verifies before/after expectations |
| **Security** | Optional (Lead decides) | Scans for security regressions introduced by structural changes |

The Lead activates Security when:
- The refactoring touches authentication, authorization, or data access layers
- The refactoring changes API surface area or data flow
- The refactoring modifies security-sensitive configuration

The Lead skips Security when:
- The refactoring is purely structural (renaming, extracting, reorganizing)
- No security-sensitive code paths are affected

### Agent Pipeline Per Task

```
Lead (dispatch) -> Coder -> Tester -> Reviewer -> [Security] -> Lead (compliance) -> Commit
```

Each agent-to-agent handoff has a retry loop (max 3 cycles). If an agent fails, Coder fixes and the failing agent re-evaluates.

## Folder Structure

```
sdlc-doc/workflows/refactor/{YYYY-MM-DD}-{slug}/
  manifest.json
  00-clarify.md
  01-research.md
  02-design/
    target-architecture.md
    migration-path.md
    before-after.md
    testing-strategy.md
    standard-verifications.md
  03-plan.md
  04-implementation-log.md
  dashboard.html              (optional, if dashboard enabled)
```
