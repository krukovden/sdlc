# Phase Delegation

How a phase runs in its own context window instead of the orchestrator's.

## Why

Phases run in sequence and, by default, in one window. Everything Clarify asked, everything
Research read, and every design alternative is still resident when Plan splits the work —
so the phase with the most decisions to make reasons on the most cluttered context.

Delegating a phase to a sub-agent gives it a clean window containing only what it needs.
The artifact it writes to disk is the handoff; only a short summary comes back. The
orchestrator's window grows by a paragraph per phase instead of by a phase.

## What can be delegated, and what cannot

| Phase | Delegate? | Why |
|-------|-----------|-----|
| **Clarify** | **No** | It is a `grilling` session — a conversation with the user. A sub-agent has no channel to ask a question and get an answer, so a delegated Clarify would invent the answers instead of asking. That is the exact failure the phase exists to prevent. |
| **Research** | **Yes, whole phase** | Reads prior artifacts, the codebase, and the web; writes `01-research.md`. No user input needed. |
| **Design** | **Production only** | Producing the artifacts delegates. The stop-gate negotiation — the user pushing back, the architect revising — is a conversation and stays with the orchestrator. The `architect` skill separately dispatches its own design-it-twice sub-agents. |
| **Plan** | **Yes, whole phase** | Reads the design artifacts, writes `03-plan.md`. No user input needed. |
| **Implement** | **Already delegated** | Has its own per-task agent pipeline — see [implement.md](implement.md). |

**Stop-gates never delegate.** Presenting the summary and waiting for approval is the
orchestrator's job in every case, delegated phase or not. A sub-agent that "approves" its
own phase has removed the control the Iron Law exists to guarantee.

## Availability

Use the same ladder the implement phase detects — Agent Teams, then Copilot Fleet, then the
`Agent` tool (see [implement.md](implement.md) → Dispatch Mode Detection). If no sub-agent
mechanism is available at all, run the phase inline in this window exactly as before and
note it at the stop-gate: the workflow still completes, it just costs the context it would
otherwise have saved.

## The contract

**What the sub-agent receives** — paths, not contents:

- the workflow type and the workflow folder path
- which prior artifacts exist, by path (it reads the ones it needs itself)
- the phase reference file to follow, e.g. `references/research.md`
- whether `--auto-approve` is active

Passing paths rather than pasted file contents is the whole point. Reading
`01-research.md` into the orchestrator's window to hand it to a sub-agent spends exactly
the context the delegation was meant to save.

**What the sub-agent returns** — a stop-gate summary under ~400 words: what it produced,
the decisions that shaped it, anything unresolved, and the paths it wrote. Not the artifact
contents; those are on disk, and the user reads them there.

**Who writes the manifest — the orchestrator, always.** It sets the phase `in_progress`
before dispatching and `approved` with `completed_at` after the user approves. A sub-agent
that also writes the manifest gives the file two writers, and the dashboard reads whichever
landed last.

## Failure

If the sub-agent returns without having written its artifact, the phase did not happen —
do not synthesize the artifact from the summary. Report what came back, and offer to re-run
the phase or continue inline. A phase artifact reconstructed from a summary is a phase that
looks complete to every downstream agent while missing everything the summary compressed.
