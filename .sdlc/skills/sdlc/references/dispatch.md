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

**End every dispatch prompt with the return instruction — do not leave it to whoever
writes the prompt.** Sub-agents routinely finish the work, write the artifact, and then go
idle without sending anything back; the orchestrator receives only an `idle_notification`
and cannot tell *success with no report* from *silent failure*. Close the prompt with this
verbatim:

> **IMPORTANT: When you are done you MUST send your stop-gate summary back as your final
> message. Do not go idle without it.** The summary is the only thing that returns to the
> orchestrator; the artifact stays on disk. A phase whose summary never arrives cannot be
> presented at the gate.

To make a silent agent recoverable in one read, have the artifact open with a
`## Stop-gate summary` section as its **first** heading, so the summary survives even when
the message does not.

**Who writes the manifest — the orchestrator, always.** It sets the phase `in_progress`
before dispatching and `approved` with `completed_at` after the user approves. A sub-agent
that also writes the manifest gives the file two writers, and the dashboard reads whichever
landed last.

## Failure

Two different silences, two different responses — do not conflate them:

**Artifact written, no summary returned.** This is the common case, not the rare one. The
agent did the work and went idle. The phase *did* happen; only the report is missing. Do
**not** re-derive the verdict by reading the whole artifact and re-running the phase's
verification — that spends exactly the context the delegation saved. Read the artifact's own
`## Stop-gate summary` section (its first heading — see above) and present *that* at the
gate, noting the summary was recovered from disk rather than returned. If the artifact has
no summary section, read only enough of it to fill the gate, and flag that the agent
returned silent.

**No artifact written.** The phase did not happen — do not synthesize the artifact from
whatever came back. Report it, and offer to re-run the phase or continue inline. A phase
artifact reconstructed from a summary is a phase that looks complete to every downstream
agent while missing everything the summary compressed.

## Capability can vanish mid-phase

Availability is not assessed only once at phase start. A usage cap, session limit, or API
error can remove sub-agent dispatch **partway through** a phase or an implement pipeline —
the agents you already dispatched come back `failed` with a reason like *"You've hit your
session limit."* When that happens, do not stall: finish the current phase or task **inline
in this window**, exactly as the "no mechanism available at all" case does, and record which
steps were **orchestrator-performed** versus **genuinely skipped**. That distinction is the
point — a review the Lead ran by hand is not the same as a review nobody ran, and the log
must let the user tell them apart. A second-opinion agent (the Rubber Duck) that could not
run is a real coverage gap, not a pass: mark it a debt and re-run it after the limit resets,
before merge — do not let an inline Lead pass stand in for it on a core task.
