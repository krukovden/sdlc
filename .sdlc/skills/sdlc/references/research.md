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
- **Hot spots first — scope before you scan.** Restructuring pays off by making *future* changes easier, so weight the parts that keep changing. Walk back a good stretch of `git log --oneline` and let the paths that keep reappearing pull your attention first; widen the net only if the churn is scattered with no clear hot spot. A cold module measured in detail is measurement you throw away.
- **Depth**: Which modules are **shallow** — interface nearly as complex as the implementation? Apply the **deletion test** to each suspect: delete it mentally, and see whether complexity vanishes (pass-through) or reappears across callers (load-bearing). Record which way each came out.
- **Dependency map**: What depends on what? What would break if changed?
- **Dependency categories**: For each module in scope, classify what it depends on — in-process / local-substitutable / remote-but-owned / true-external (see the `architect` skill). This determines where a seam can go and how it gets tested, so it belongs in research, not in design.
- **Coupling analysis**: Which components are tightly coupled? Where does understanding one concept require bouncing between many small modules?
- **Risk areas**: Where are the fragile parts? What has poor test coverage, or is hard to test through its current interface?
- **Test inventory**: Which existing tests are bound to the *internals* of modules in scope? Those become waste when the seam moves — Design decides which get deleted, but Research is where they are found.
- **Code metrics**: File sizes, complexity, duplication
- **Output focus**: Structural analysis — what's shallow, what's hot, and how to deepen it

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
2. **Delegate the codebase walk to a sub-agent.** Dispatch the `Explore` subagent type (or the `Agent` tool where that type is unavailable) with the scope from `00-clarify.md` and ask it to return findings — key files with their purpose, existing patterns, integration points, risks — rather than file contents. Reading dozens of files directly fills the window that Design and Plan still have to work in; the sub-agent burns its own context and hands back a summary. Read files yourself only when the sub-agent's finding is the thing you must verify line by line.
3. **Use web search** to verify assumptions, check library versions, find known issues. This is the phase's other half — see below
4. Focus research on areas relevant to the task (don't explore everything)
5. Produce the `01-research.md` artifact

### Why delegate

Everything this phase reads would otherwise still be resident when the Architect designs
and the Planner splits tasks. Pushing the file-by-file reading into a sub-agent is what
keeps the later phases reasoning on a clean window instead of on the residue of this one.

Dispatch several Explore sub-agents in parallel when the scope has independent areas — one
per subsystem, per stack, or per question — and merge what they return.

**If this phase is itself running in a sub-agent** (the default — see
[dispatch.md](dispatch.md)), you already have a clean window that nothing downstream
inherits, so read the files directly. Dispatching from here would be a second level of
nesting, which many harnesses cap or refuse, and it buys nothing: the context you would be
protecting is discarded the moment this phase returns its summary. Delegate from inside the
phase only when the phase is running inline in the orchestrator's window.

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

If `--auto-approve` is active, skip this gate — proceed immediately to the next phase.

Otherwise, present the stop-gate after producing the artifact. Include key findings and any risks discovered.
