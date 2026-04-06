---
name: sdlc-clarify
description: "SDLC clarify phase — refines task scope, constraints, and success criteria through targeted questions. Produces 00-clarify.md artifact. Question focus varies by workflow type (feature, bugfix, refactor, spike)."
---

# SDLC Clarify Phase

## Purpose

Refine the task description into a clear, unambiguous scope with constraints and success criteria. Ask targeted questions one at a time until you have enough clarity to proceed.

## Artifact Gating

No prerequisite artifacts needed — this is the first phase.

## Workflow-Specific Focus

### Feature
- **Intent**: What capability is being added? What problem does it solve?
- **Scope**: What's included? What's explicitly excluded?
- **Constraints**: Performance requirements? Compatibility needs? Deadline?
- **Success criteria**: How do we know this feature is done and correct?
- **Users**: Who uses this feature? What's their workflow?

### Bugfix
- **Reproduction**: Can you reproduce consistently? What are the exact steps?
- **Error details**: What endpoint/function? What error message/code?
- **Expected vs actual**: What should happen? What happens instead?
- **Environment**: Does it happen in all environments? Since when?
- **Impact**: How many users affected? Is there a workaround?

### Refactor
- **Problem**: What's wrong with the current structure? What pain does it cause?
- **Desired outcome**: What does the improved structure look like?
- **Risk tolerance**: Can we tolerate brief regressions? Is there a rollback plan?
- **Scope**: Which parts of the codebase? Any areas explicitly off-limits?
- **Behavior preservation**: Must all existing behavior be preserved exactly?

### Spike
- **Question**: What specific question needs answering?
- **Decision**: What decision depends on this research?
- **Constraints**: Any technologies or approaches already ruled out?
- **Depth**: How deep should the investigation go? Time-boxed?
- **Deliverable**: What format should the recommendation take?

## How to Work

1. Read the task description from the user or from $ARGUMENTS
2. Ask clarifying questions **one at a time**, prefer multiple choice when possible
3. Continue until you have clear scope, constraints, and success criteria
4. Produce the `00-clarify.md` artifact

## Output Artifact

Write `00-clarify.md` to the workflow folder with this structure:

```markdown
# Task Clarification

## Task Description
{original description}

## Workflow Type
{feature | bugfix | refactor | spike}

## Refined Scope
{clear description of what will be done}

## Constraints
- {constraint 1}
- {constraint 2}

## Success Criteria
- {criterion 1}
- {criterion 2}

## Out of Scope
- {exclusion 1}
- {exclusion 2}

## Key Decisions Made
- {decision 1}: {rationale}
- {decision 2}: {rationale}
```

## Manifest Update

- Set clarify phase status to `in_progress` when starting
- Set to `approved` with `completed_at` after user approves

## Stop-Gate

Present the stop-gate after producing the artifact. Include the refined scope summary and key decisions surfaced.
