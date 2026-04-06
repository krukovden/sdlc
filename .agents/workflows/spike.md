# Spike Workflow

## Overview

The Spike workflow is a research-only pipeline for answering technical questions, evaluating options, and making informed decisions without writing implementation code. It terminates after the Design phase -- there is no Plan or Implement phase. The Lead agent operates alone; no agent team is dispatched.

**Trigger:** `/sdlc spike "description"` or inferred when the description indicates research, evaluation, or comparison without implementation intent.

## Phases

| # | Phase | Agent | Gate | Description |
|---|-------|-------|------|-------------|
| 1 | **Clarify** | Lead | User approval | Define the question to answer, the decision to make, and desired depth |
| 2 | **Research** | Lead | User approval | Survey the technology landscape, inventory options, review prior art |
| 3 | **Design** | Lead | **DONE** | Produce options analysis and recommendation |

There is no Plan or Implement phase. The spike is complete after Design.

### Clarify Focus Areas

- **What question** -- the specific technical question to answer
- **What decision** -- the decision this spike will inform
- **Depth** -- how deep the investigation should go (quick survey vs. thorough analysis)

### Research Focus Areas

- Technology landscape relevant to the question
- Options inventory with trade-offs
- Prior art (how others have solved similar problems)

### Design Output

Instead of architecture artifacts, the Design phase produces:
1. **Options analysis** -- structured comparison of viable approaches
2. **Recommendation** -- the recommended path forward with justification

## Artifacts

### Phase Outputs

| Phase | Artifact | Path |
|-------|----------|------|
| Clarify | Clarification document | `00-clarify.md` |
| Research | Research findings | `01-research.md` |
| Design | Options analysis | `02-design/options-analysis.md` |
| Design | Recommendation | `02-design/recommendation.md` |

### No Artifact Consumers

Since no implementation phase exists, design artifacts are not consumed by agents. They serve as decision records for future workflows.

## Agent Activation

No agent team is dispatched. The Lead operates alone throughout all three phases.

| Agent | Activation | Role |
|-------|------------|------|
| **Lead** | Always | Runs all three phases: clarify, research, design |
| **Coder** | Not activated | -- |
| **Tester** | Not activated | -- |
| **Reviewer** | Not activated | -- |
| **Security** | Not activated | -- |

## Spike Completion

When the Design phase is complete, the workflow terminates with a summary:

```
Spike Complete: {slug}
-------------------------------------
Summary: [2-3 sentence overview of findings and recommendation]

Artifacts produced:
  - 02-design/options-analysis.md
  - 02-design/recommendation.md

This spike is complete. No implementation phase.
Use these findings as input to a future /sdlc feature or /sdlc refactor.
-------------------------------------
```

The spike's artifacts can be referenced when starting a subsequent Feature or Refactor workflow.

## Folder Structure

```
docs/workflows/spike/{YYYY-MM-DD}-{slug}/
  manifest.json
  00-clarify.md
  01-research.md
  02-design/
    options-analysis.md
    recommendation.md
  dashboard.html              (optional, if dashboard enabled)
```

### Manifest Differences

The spike manifest omits `plan` and `implement` from the phases object:

```json
{
  "phases": {
    "clarify":  { "status": "pending" },
    "research": { "status": "pending" },
    "design":   { "status": "pending" }
  },
  "tasks": []
}
```

The `tasks` array remains empty throughout the workflow since no implementation tasks are created.
