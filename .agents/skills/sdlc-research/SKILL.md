---
name: sdlc-research
description: "SDLC research phase — analyzes current codebase state relevant to the task. Produces 01-research.md artifact. Focus varies by workflow type: domain models (feature), failure trace (bugfix), dependency map (refactor), options inventory (spike)."
---

# SDLC Research Phase

## Purpose

Analyze the current codebase state relevant to the task. Understand what exists, how it works, and what needs to change.

## Artifact Gating

**Requires**: `00-clarify.md`

If missing, present warning:
> "⚠ Clarify artifact (00-clarify.md) not found. You can:
> 1. Run clarify first (/sdlc:clarify)
> 2. Proceed anyway (I'll work with what I have)
> 3. Abort"

## Workflow-Specific Research

### Feature
- **Domain models**: Identify relevant entities, their relationships, and data flow
- **Existing patterns**: How does the codebase handle similar features?
- **Integration points**: What existing code will the new feature connect to?
- **API conventions**: Current naming, versioning, response format patterns
- **Output focus**: Current-state analysis — what exists and how to expand it

### Bugfix
- **Failure trace**: Trace the execution path that leads to the error
- **Affected components**: Which files/functions are involved?
- **Similar patterns**: Are there other places with the same vulnerable pattern?
- **Recent changes**: Did a recent change introduce this bug?
- **Utility**: If `superpowers:systematic-debugging` is available, invoke it for structured root-cause analysis
- **Output focus**: Reproduction analysis — why does it fail and where

### Refactor
- **Dependency map**: What depends on what? What would break if changed?
- **Coupling analysis**: Which components are tightly coupled?
- **Risk areas**: Where are the fragile parts? What has poor test coverage?
- **Code metrics**: File sizes, complexity, duplication
- **Output focus**: Structural analysis — what's tangled and how to untangle it

### Spike
- **Technology landscape**: What options exist? What are their trade-offs?
- **Prior art**: Has anyone in the codebase or community solved this?
- **Compatibility**: What constraints does our stack impose?
- **Options inventory**: List viable approaches with pros/cons
- **Output focus**: Options inventory — what are the choices

## Web Search

Use web search when local codebase analysis is not enough. Do NOT skip this — external context prevents outdated decisions.

| Workflow | When to search | What to look for |
|----------|---------------|-----------------|
| **Feature** | Always | Does the framework have a built-in solution? Any known gotchas? Recent breaking changes in dependencies? |
| **Bugfix** | When root cause is unclear | Known issues in dependencies, GitHub issues, Stack Overflow threads with same error |
| **Refactor** | When evaluating patterns | Current best practices for the pattern, migration guides, deprecation notices |
| **Spike** | Always — this is the primary tool | Library comparisons, benchmarks, community adoption, license compatibility, maintenance status |

### What to include from web search

- **Library versions** — latest stable version, not what's in training data
- **API changes** — deprecated methods, new recommended approaches
- **Known issues** — open bugs in dependencies that affect this work
- **Community consensus** — widely adopted vs experimental approaches

### What NOT to do

- Don't search for basic language syntax or patterns you already know
- Don't copy-paste solutions without understanding them
- Always cite sources in the research artifact: `[Source](URL)`

## How to Work

1. Read `00-clarify.md` to understand the refined scope
2. Explore the codebase using Glob, Grep, Read tools
3. **Use web search** to verify assumptions, check library versions, find known issues
4. Focus research on areas relevant to the task (don't explore everything)
5. Produce the `01-research.md` artifact

## Output Artifact

Write `01-research.md` to the workflow folder with this structure:

```markdown
# Research Findings

## Scope
{what was researched and why}

## Current State
{description of relevant existing code, architecture, and patterns}

## Key Files
| File | Purpose | Relevance |
|------|---------|-----------|
| path/to/file | what it does | how it relates to this task |

## Findings
{detailed findings organized by topic}

## Patterns to Follow
- {existing pattern 1 — follow this convention}
- {existing pattern 2}

## Risks & Concerns
- {risk 1}
- {risk 2}

## Recommendations
- {recommendation for design phase}
```

## Manifest Update

- Set research phase status to `in_progress` when starting
- Set to `approved` with `completed_at` after user approves

## Stop-Gate

Present the stop-gate after producing the artifact. Include key findings and any risks discovered.
