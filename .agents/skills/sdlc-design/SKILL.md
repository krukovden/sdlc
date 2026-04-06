---
name: sdlc-design
description: "SDLC design phase — produces architecture artifacts in 02-design/ folder. Artifacts vary by workflow type: architecture diagrams + API contracts (feature), root cause analysis + fix strategy (bugfix), target architecture + migration path (refactor), options analysis + recommendation (spike)."
---

# SDLC Design Phase

## Purpose

Produce structured design artifacts that fully specify the architectural decisions, contracts, and verification criteria for the task. These artifacts become the contract that implementation agents follow.

## Artifact Gating

**Requires**: `01-research.md`

If missing, present warning with options to run research first, proceed anyway, or abort.

## Workflow-Specific Artifacts

Create the `02-design/` subfolder in the workflow folder, then produce these files:

### Feature (6 artifacts)

| File | Content |
|------|---------|
| `architecture-diagrams.md` | C4 component diagrams, data flow diagrams, sequence diagrams showing how the new feature integrates |
| `architecture-decisions.md` | ADRs (Architecture Decision Records) for each significant decision — what was decided, why, and what alternatives were rejected |
| `api-contracts.md` | Endpoint definitions: method, path, request/response schemas, status codes, error responses |
| `storage-model.md` | Entity definitions, relationships, database migrations, indexes |
| `testing-strategy.md` | What to test, test types (unit/integration/e2e), coverage expectations, edge cases to cover |
| `standard-verifications.md` | Full checklist: architecture compliance, API contract match, security, performance, accessibility |

### Bugfix (5 artifacts)

| File | Content |
|------|---------|
| `root-cause-analysis.md` | Detailed trace of the bug: reproduction steps, failure point, root cause, evidence |
| `fix-strategy.md` | What to change, why this fix is correct, what NOT to change, minimal intervention principle |
| `blast-radius.md` | What other code/features could be affected by this fix, what to verify after fixing |
| `regression-test-plan.md` | Tests that prove the bug is fixed and prevent regression, edge cases around the fix |
| `standard-verifications.md` | Focused checklist: regression verification, fix correctness, no side effects, blast radius confirmed |

### Refactor (5 artifacts)

| File | Content |
|------|---------|
| `target-architecture.md` | What the refactored code should look like — structure, responsibilities, interfaces |
| `migration-path.md` | Step-by-step migration plan with rollback points at each step |
| `before-after-comparison.md` | Side-by-side showing current vs target for key components |
| `testing-strategy.md` | How to verify behavior is preserved — what tests exist, what tests to add |
| `standard-verifications.md` | Structural checklist: behavior preservation, no API changes, dependency integrity, test coverage maintained |

### Spike (2 artifacts)

| File | Content |
|------|---------|
| `options-analysis.md` | Each option with: description, pros, cons, effort estimate, risks, compatibility with existing stack |
| `recommendation.md` | Recommended option with rationale, next steps if approved, what would change in the codebase |

## Standard Verifications Content

The `standard-verifications.md` content varies by workflow type:

- **Feature**: Architecture compliance, API contract match, security checks, performance considerations, accessibility
- **Bugfix**: Regression verification, fix correctness, no side effects, blast radius confirmed
- **Refactor**: Behavior preservation, no API changes, dependency integrity, test coverage maintained

## Spike Completion

If the workflow type is **Spike**, this is the final phase. After producing artifacts, present the spike completion message (defined in the `sdlc` master skill) instead of continuing to Plan.

## Web Search

Use web search during design to validate decisions and catch outdated assumptions.

| When | What to search |
|------|---------------|
| Choosing between architectural approaches | Current best practices, framework recommendations |
| Designing API contracts | REST/GraphQL conventions, OpenAPI patterns, framework-specific routing |
| Selecting libraries or patterns | Latest stable versions, breaking changes, deprecation timelines |
| Spike options analysis | Detailed comparisons, benchmarks, production case studies, license terms |
| Security design decisions | OWASP current recommendations, known vulnerability patterns |

Always cite sources in design artifacts: `[Source](URL)`.

## How to Work

1. Read `00-clarify.md` and `01-research.md` to understand scope and current state
2. **Use web search** to validate architectural choices against current best practices
3. Make architectural decisions based on research findings, existing patterns, and verified external context
4. Produce all artifacts for the workflow type
5. Each artifact should be detailed enough that an implementer can work from it alone

## Manifest Update

- Set design phase status to `in_progress` when starting
- Set to `approved` with `completed_at` after user approves

## Stop-Gate

Present the stop-gate listing all produced artifacts with one-line descriptions and key architectural decisions made.
