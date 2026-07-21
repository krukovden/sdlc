# SDLC Clarify Phase

## Purpose

Refine the task description into a clear, unambiguous scope with constraints and success criteria.

**Run this phase as a `grilling` session** — load `.sdlc/skills/grilling/SKILL.md` and follow it. It carries the method: one question at a time, a recommended answer with every question, facts looked up rather than asked, and depth before breadth. The focus areas below are the **roots of the decision tree** that session walks, not a checklist to tick off.

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
- **Problem**: What's wrong with the current structure? What pain does it cause? Sharpen a vague "it's tangled" with the **deletion test** — imagine the module deleted: does complexity vanish (it was a pass-through) or reappear across N callers (it was load-bearing)? Bring the result to the user as your recommended reading, not as a question they have to answer cold.
- **Churn**: Is this area actually changing? Restructuring code nobody touches buys nothing — check `git log` for the paths in scope before agreeing the work is worth doing, and say so if it looks cold.
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

1. Read the task description from the user or from `$ARGUMENTS`
2. **Look up what the repository already answers**, before asking anything. Cheap lookups belong here: `package.json` / `*.csproj` for stack and versions, the test runner, an existing endpoint or entity, naming conventions in a neighbouring file, recent `git log` for whether this area is churning. This is not the Research phase — you are not mapping the codebase, you are refusing to spend the user's attention on questions the repo answers for free. Deep analysis waits for `01-research.md`.
3. Run the `grilling` session over the focus areas above, treating them as tree roots
4. Stop when the completion criterion below is met — not when the topics have each been touched once
5. Produce the `00-clarify.md` artifact

## Completion Criterion

Clarify is done when **all four** hold. Check them explicitly before writing the artifact:

- [ ] **Every focus area is resolved or dismissed on the record.** Each bullet for this workflow type has either an answer the user gave, or an explicit "not applicable, because …". Silence is not coverage.
- [ ] **Success criteria are testable as written.** Someone could write a test or run a check from them without asking you what you meant. "Fast enough" fails; "p95 under 200 ms at 1000 rps" passes. "Works correctly" fails; "returns 409 on duplicate submit, existing record unchanged" passes.
- [ ] **Every entry under Key Decisions Made traces to a user answer.** Anything you settled yourself belongs under Assumptions, not Decisions.
- [ ] **No open question remains whose answer would change the Design artifacts.** If the answer would move an API contract, a storage model, or a migration step, it is not an open question — it is this phase's work, unfinished.

If you catch yourself reaching for the artifact template while a box above is unchecked, the phase is not done — the pull of the next step is not evidence that this one finished.

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
- {decision 1}: {rationale} — _asked and answered_
- {decision 2}: {rationale} — _asked and answered_

## Assumptions (unverified)
- {assumption 1}: {what you filled in, and what it would change if wrong}
- {assumption 2}: {…}

_Empty is the good outcome. Anything here is something the user has not confirmed — it is carried into Research and Design as a risk, and the stop-gate must show it._
```

## Manifest Update

- Set clarify phase status to `in_progress` when starting
- Set to `approved` with `completed_at` after user approves

## Stop-Gate

If `--auto-approve` is active, skip this gate — proceed immediately to the next phase.

Otherwise, present the stop-gate after producing the artifact. Include the refined scope summary, the key decisions surfaced, and — separately and unmissably — **every entry from Assumptions (unverified)**. Assumptions are the phase's honest output about what it could not settle; burying them in the artifact is how an unasked question reaches Implement.

Under `--auto-approve` the grilling session has no one to answer it. Do not invent answers: proceed on your best reading, and record **every** unresolved branch under Assumptions so the gap is visible in the artifact even though no one was there to close it.
