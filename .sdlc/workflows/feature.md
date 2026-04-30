# Feature Workflow

## Overview

The Feature workflow is the full SDLC pipeline for building new capabilities. It follows all five phases with the complete agent team, producing the most comprehensive artifact set. Use this workflow when adding wholly new functionality to the system.

**Trigger:** `/sdlc feature "description"` or inferred when the description does not match bugfix, refactor, or spike patterns.

## Phases

| # | Phase | Agent | Gate | Description |
|---|-------|-------|------|-------------|
| 1 | **Clarify** | Lead | User approval | Establish intent, scope, constraints, and success criteria |
| 2 | **Research** | Lead | User approval | Analyze domain models, existing patterns, and integration points |
| 3 | **Design** | Lead (architect skill) | User approval | Produce architecture and contract artifacts |
| 4 | **Plan** | Lead | User approval | Break design into ordered implementation tasks by architectural layer (domain -> interfaces -> adapters) |
| 5 | **Implement** | All 5 agents | User approval per task | Execute tasks sequentially through the full agent pipeline |

### Clarify Focus Areas

- What is the user's intent?
- What is the scope boundary?
- What constraints apply (technical, business, timeline)?
- What are the success criteria?

### Research Focus Areas

- Domain models relevant to the feature
- Existing patterns in the codebase to follow or extend
- Integration points with other systems or modules

### Plan Strategy

Tasks are ordered by architectural layer:
1. **Domain** -- core business logic, entities, value objects
2. **Interfaces** -- API contracts, DTOs, controllers
3. **Adapters** -- repositories, external service clients, UI components

## Artifacts

### Phase Outputs

| Phase | Artifact | Path |
|-------|----------|------|
| Clarify | Clarification document | `00-clarify.md` |
| Research | Research findings | `01-research.md` |
| Design | Architecture diagrams | `02-design/architecture-diagrams.md` |
| Design | Architecture decisions | `02-design/architecture-decisions.md` |
| Design | API contracts | `02-design/api-contracts.md` |
| Design | Storage model | `02-design/storage-model.md` |
| Design | Testing strategy | `02-design/testing-strategy.md` |
| Design | Standard verifications | `02-design/standard-verifications.md` |
| Plan | Implementation plan | `03-plan.md` |
| Implement | Implementation log | `04-implementation-log.md` |

### Artifact Consumers

| Artifact | Consumed By |
|----------|-------------|
| `api-contracts.md` | Coder, Security, Lead (compliance) |
| `storage-model.md` | Coder, Lead (compliance) |
| `architecture-decisions.md` | Coder, Lead (compliance) |
| `architecture-diagrams.md` | Lead (compliance) |
| `testing-strategy.md` | Tester, Lead (compliance) |
| `standard-verifications.md` | Reviewer |

## Agent Activation

All five agents are activated for every implementation task.

| Agent | Activation | Role |
|-------|------------|------|
| **Lead** | Always | Orchestrates task dispatch, performs design compliance check after all agents pass |
| **Coder** | Always | Writes implementation code for the assigned task |
| **Tester** | Always | Writes and runs tests based on testing strategy |
| **Reviewer** | Always | Reviews code quality against standard verifications and principles |
| **Security** | Always | Scans code for security issues, validates against API contracts |

### Agent Pipeline Per Task

```
Lead (dispatch) -> Coder -> Tester -> Reviewer -> Security -> Lead (compliance) -> Commit
```

Each agent-to-agent handoff has a retry loop (max 3 cycles). If an agent fails, Coder fixes and the failing agent re-evaluates.

## Folder Structure

```
sdlc-doc/workflows/feature/{YYYY-MM-DD}-{slug}/
  manifest.json
  00-clarify.md
  01-research.md
  02-design/
    architecture-diagrams.md
    architecture-decisions.md
    api-contracts.md
    storage-model.md
    testing-strategy.md
    standard-verifications.md
  03-plan.md
  04-implementation-log.md
  dashboard.html              (optional, if dashboard enabled)
```
