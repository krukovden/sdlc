---
name: sdlc-implement
description: "SDLC implement phase — executes plan tasks via multi-agent team (Lead, Coder, Tester, Reviewer, Security). Each agent runs in isolated context with only the artifacts it needs. Produces 04-implementation-log.md."
---

# SDLC Implement Phase

## Purpose

Execute the implementation plan task by task using the multi-agent team. Each task goes through a defined agent sequence with quality gates. Results are logged in `04-implementation-log.md`.

## Artifact Gating

**Requires**: `03-plan.md`

If missing, present warning with options to run plan first, proceed anyway, or abort.

## Dispatch Mode Detection

At the start of the implement phase, detect which dispatch mode is available:

1. **Agent Teams** — check if `TeamCreate` tool is available. If yes, use team mode.
2. **Copilot Fleet** — check if `gh copilot fleet` is available. If yes, use fleet mode.
3. **Subagents** — fallback. Use the `Agent` tool for sequential dispatch.

### Team Mode (Agent Teams available)

When Agent Teams is available, create a team and spawn teammates for **independent tasks** in parallel:

1. Read `03-plan.md` and identify independent tasks (no dependencies between them)
2. Create an agent team with the Lead as coordinator
3. For independent tasks: spawn teammates in parallel, each using the appropriate agent type (`sdlc-coder`, `sdlc-tester`, etc.)
4. For dependent tasks: wait for dependencies to complete, then spawn
5. Each teammate follows the full pipeline: Coder → Tester → Reviewer → Security → Rubber Duck (if enabled)
6. Teammates report results via the shared task list
7. Lead performs compliance check after each task completes

### Copilot Fleet Mode

When Copilot Fleet is available, dispatch independent tasks in parallel via fleet:

1. Read `03-plan.md` and identify independent tasks
2. Dispatch independent tasks simultaneously via `gh copilot fleet`
3. Each fleet worker runs the full pipeline: Coder → Tester → Reviewer → Security → Rubber Duck (if enabled)
4. Dependent tasks wait for their dependencies before dispatching
5. Lead performs compliance check after each task completes

**Example:** If Task 1 and Task 4 are independent, spawn two Coder teammates simultaneously. If Task 2 depends on Task 1, wait for Task 1 to finish before spawning Task 2's Coder.

### Sequential Mode (Subagents only)

When Agent Teams is NOT available, dispatch agents sequentially using the `Agent` tool:

For each task in `03-plan.md`, dispatch agents in this order:

| Workflow | Agent Sequence |
|----------|---------------|
| Feature | Coder → Tester → Reviewer → Security → Rubber Duck (if enabled) → Lead (compliance check) |
| Bugfix | Coder → Tester → Reviewer → Security → Rubber Duck (if enabled) → Lead (compliance check) |
| Refactor | Coder → Tester → Reviewer → Security (if activated) → Rubber Duck (if enabled) → Lead (compliance check) |

## Task Execution Mode

Before dispatching each task, check its `mode` field from `03-plan.md`:

### Autonomous mode (`mode: autonomous`)

Dispatch the Coder agent **once** with the full autonomous pipeline instruction. The Coder will chain through Tester → Reviewer → Security and return the completed pipeline context.

**Dispatch prompt for autonomous mode:**

```
You are the Coder agent for the SDLC workflow.
pipeline_mode: autonomous

## Pipeline Context
{
  "task": {
    "id": {N},
    "title": "{task title}",
    "skill": "{domain-skill}",
    "mode": "autonomous"
  }
}

## Your Task
{task description from 03-plan.md}

## Design Artifacts
Read these files for context:
- {path to relevant design artifacts}

## Domain Skill (PRIMARY)
Read: .sdlc/skills/{domain-skill}/SKILL.md

## Supplementary Skills (MERGED)
{supplementary skill paths, if any}

## Testing Artifact
{path to testing-strategy.md or regression-test-plan.md}

## Verifications Checklist
{path to standard-verifications.md}

## API Contracts
{path to api-contracts.md, if exists}

## Instructions
1. Implement the task
2. Append your results to the pipeline context
3. Spawn the Tester agent as a subagent, passing the pipeline context and all artifact paths above
4. The Tester will chain through Reviewer → Security
5. Return the completed pipeline context
```

**After the pipeline returns:**

1. Parse the pipeline context from the Coder's response
2. Check if any agent has status `FAILED`:
   - If yes, this is a pipeline failure — handle as a failed task (update manifest, present Failed Task Stop-Gate)
3. If all agents passed, run the Lead compliance check against design artifacts
4. If compliant, commit. If deviation found, handle per existing deviation logic.
5. Update `04-implementation-log.md` with results from the pipeline context

### Mediated mode (`mode: mediated`)

Follow the existing dispatch pattern — Lead dispatches each agent individually and mediates every handoff. This is the current behavior, unchanged.

Specifically: dispatch Coder → check result → dispatch Tester → check result → retry if needed → dispatch Reviewer → check result → retry if needed → dispatch Security → check result → retry if needed → compliance check → commit.

## Agent Context Isolation

Each agent receives **only** what it needs. Construct precise prompts — regardless of dispatch mode.

In **mediated mode**, Lead constructs each agent's prompt individually using the sections below.
In **autonomous mode**, Lead constructs only the Coder's initial prompt (using the autonomous dispatch template above). Subsequent agents receive context via the pipeline context object passed through the chain.

### Coder receives:
- Single task from `03-plan.md` (not the full plan)
- Relevant design artifacts: `api-contracts.md`, `storage-model.md`, `architecture-decisions.md` (whatever exists)
- Domain skill file path for the task
- Instruction to read the domain skill

### Tester receives:
- Single task from `03-plan.md`
- Summary of what Coder implemented (files changed)
- `02-design/testing-strategy.md` OR `02-design/regression-test-plan.md` (whichever exists)
- Domain skill file path

### Reviewer receives:
- Single task from `03-plan.md`
- Summary of what Coder implemented (files changed)
- Summary of Tester's results (tests passed/failed)
- `02-design/standard-verifications.md`
- Domain skill file path

### Security receives:
- Single task from `03-plan.md`
- Summary of what Coder implemented (files changed)
- `02-design/api-contracts.md` (if exists)
- Domain skill file path

## Agent Dispatch Template

When dispatching each agent, construct a prompt that includes:

**Note:** This template applies to **mediated mode** dispatch. For **autonomous mode**, use the autonomous dispatch template in the "Task Execution Mode" section above.

```
You are the {Agent} agent for the SDLC workflow.

## Your Task
{task description from 03-plan.md}

## Design Artifacts
Read these files for context:
- {path to artifact 1}
- {path to artifact 2}

## Domain Skill (PRIMARY — these patterns govern)
Read: .claude/skills/SKILL.{domain-skill}.md

## Supplementary Skills (MERGED — adopt non-conflicting practices)
Read: {external-skill-path-1}
Read: {external-skill-path-2}
These supplement the primary skill. If any instruction here conflicts
with the primary skill above, follow the primary skill.

## What Was Done Before You
{summary of prior agent outputs for this task}

## Your Job
{agent-specific instructions}
```

See `sdlc-lead.md` Skill Resolution section for how to identify supplementary skills.

## Retry Logic

If an agent reports issues:

**Note:** This retry logic applies to **mediated mode** only. In **autonomous mode**, each agent handles its own retry loop with Coder (max 3 cycles per agent). Lead only sees the final result.

### Tester reports test failures:
1. Dispatch Coder with the failure details and ask to fix
2. Re-dispatch Tester to verify
3. Max 3 cycles — then mark task as `failed` and present the Failed Task Stop-Gate

### Reviewer returns NEEDS CHANGES:
1. Dispatch Coder with the review feedback and specific items to fix
2. Re-dispatch Reviewer to verify
3. Max 3 cycles — then mark task as `failed` and present the Failed Task Stop-Gate

### Security returns SECURITY ISSUE:
1. Dispatch Coder with the remediation steps
2. Re-dispatch Security to verify
3. Max 3 cycles — then mark task as `failed` and present the Failed Task Stop-Gate

### Lead compliance check returns DEVIATION FOUND:
- Minor deviation → dispatch Coder to fix, re-check
- Design was wrong → update design artifact, notify user at stop-gate

### On exhausted retries (any agent):
Update manifest.json:
- Set task `status` to `failed`
- Set `failed_agent` to the agent that couldn't pass
- Set `failure_reason` to the last error/feedback from that agent
- Set `retry_count` to the number of retries attempted

## Commit Per Task

After all agents pass for a task:
1. Stage the changed files (specific files, not `git add -A`)
2. Commit with format: `{type}: {short title}` + description bullets
3. Types: feature → `feat:`, bugfix → `fix:`, refactor → `refactor:`
4. **NO `Co-Authored-By` footer**

## Implementation Log

Update `04-implementation-log.md` after each task. This log is the data source for the Workflow Completion summary.

```markdown
# Implementation Log

## Task 1: {title}
- **Status**: ✅ Complete
- **Skill**: {primary} + {supplementary if any}
- **Files changed**: {list of files created or modified}
- **Coder**: {brief description of what was implemented}
- **Tester**: {test results — X tests, all passing}
- **Reviewer**: PASS
- **Security**: PASS
- **Rubber Duck**: PASS (claude-opus-4-7) — {brief summary} | disabled
- **Compliance**: COMPLIANT
- **Retries**: {0 or N — which agent, what was fixed}
- **Commit**: {commit hash} — {commit message}

## Task 2: {title}
- **Status**: ⏳ In progress
...

## Task 3: {title}
- **Status**: ❌ Failed
- **Skill**: {primary} + {supplementary if any}
- **Files changed**: {files that were created/modified before failure}
- **Failed at**: {agent name} (after {retry_count} retries)
- **Reason**: {last error/feedback}
- **Coder**: {what was built before failure}
- **Tester**: {status}
- **Reviewer**: {status — may be "not reached"}
- **Security**: {status — may be "not reached"}
- **Impact**: {what this failure means for the overall feature}
- **User decision**: {retry | skip | edit | redesign | abort}

## Finalize
- **Holistic review**: {CLEAN or description of issues found}
- **Simplification**: {what was changed, or "skipped"}
- **Tests after simplify**: {X passing, 0 failing}
- **Commit**: {hash if applied}
```

## Task Completion (No Stop-Gate)

After each task is complete (all agents pass), log a brief status line and **continue immediately** to the next task. Do NOT stop for user approval between tasks.

```
  ✅ Task {N}: {title} — {files changed count} files, {test count} tests, commit {hash}
```

Only stop for user input if:
- A task **fails** after exhausting retries (see Failed Task Stop-Gate)
- **All tasks are done** (see Workflow Completion)

## Task Dependency Resolution

Before starting a task, check its `Depends on` field from `03-plan.md`:

1. If a task depends on another task, it **must not start** until the dependency is completed
2. If a dependency task failed or was skipped, present:
   ```
   ⚠ Task {N}: {title} depends on Task {dep} which {failed|was skipped}.
   You can:
     → skip    — skip this task too
     → force   — attempt anyway (dependency output may be missing)
     → abort   — stop the workflow
   ```
3. Independent tasks (no dependencies) proceed in plan order
4. When using Agent Teams (Claude Code), independent tasks MAY run in parallel

## Failed Task Stop-Gate

If `--auto-approve` is active and a task fails, skip it (set status to `skipped`) and continue to the next task. Log the failure but do not stop.

Otherwise, when a task exhausts retries (3 cycles on any agent), present:

```
❌ Task {N} Failed: {title}
─────────────────────────────────
Failed at: {agent name} (after {retry_count} retries)
Reason: {last error/feedback from the agent}

Agent results:
  Coder:      {status}
  Tester:     {status}
  Reviewer:   {status}
  Security:   {status}
  Compliance: {status}

You can:
  → retry          — reset retry count, try again from failed agent
  → skip           — mark task as skipped, continue to next task
  → edit           — manually fix the code, then re-run from failed agent
  → redesign       — go back to design phase for this task
  → abort          — stop the workflow
─────────────────────────────────
```

If user chooses `skip`, set task status to `skipped` in manifest and continue. The skipped task appears in the final summary.

## Finalize Phase

After all tasks are processed but **before** presenting the Workflow Completion summary, run a holistic review of all changes together. This catches cross-task issues that isolated per-task agents cannot see.

### Step 1: Holistic Review (Reviewer agent)

Dispatch the Reviewer agent with the **full changeset** (not a single task):

```
You are the Reviewer agent running a HOLISTIC review.

## Context
All {N} tasks have been implemented individually. Each task was reviewed
in isolation. Your job is to review the COMBINED changeset for issues
that only become visible when looking at everything together.

## All changed files
{git diff --stat from branch point}

## Check for:
- Duplicated logic across tasks (similar helpers, shared utilities that should be extracted)
- Naming inconsistencies between tasks (different naming conventions used by different Coders)
- Unnecessary abstractions that emerged from task isolation
- Cross-task integration issues (does Task 2's output work correctly with Task 4's input?)
- Dead code introduced by one task and made obsolete by another

## Design artifacts for reference
Read: {path to architecture-decisions.md}
Read: {path to api-contracts.md}

## Output
Report: CLEAN or ISSUES FOUND with specific file paths and recommendations
```

### Step 2: Simplify (Coder agent)

If the Reviewer found issues, OR unconditionally for Feature/Refactor workflows with 3+ tasks, dispatch the Coder agent with the `simplify` approach:

```
You are the Coder agent running a SIMPLIFICATION pass.

## Context
{N} tasks were implemented atomically. The holistic Reviewer found:
{reviewer findings, or "no issues — but simplify anyway for a clean result"}

## Your job
- Remove duplication across task boundaries
- Consolidate naming conventions
- Extract shared logic where 3+ real duplications exist (not speculative)
- Remove unnecessary abstractions or intermediate layers
- Ensure consistent error handling patterns across all new code
- Do NOT change functionality — only simplify structure

## Changed files to focus on
{list of all files changed across all tasks}

## Rules
- Keep changes minimal and safe
- Run existing tests after changes to verify nothing breaks
- If unsure about a simplification, skip it
```

### Step 3: Full Verification (Tester agent — Level 1 + 2)

Dispatch the Tester agent for the Finalize phase:

```
You are the Tester agent running FINALIZE verification.

## Context
All tasks are complete. The Coder just ran a simplification pass.
You must verify the ENTIRE project still works — not just individual tasks.

## Run verification levels:
1. Level 1 (Build): Run build for all affected projects
2. Level 2 (Tests): Run the FULL test suite, not just task-specific tests

## Report
Include: build results, full test suite results
```

### Step 4: Final Commit

If simplification produced changes:
- Commit with: `refactor: simplify {slug} implementation`
- This is a separate commit from the per-task commits

### Skip conditions

Skip the Finalize phase entirely if:
- Workflow is a Bugfix with only 1 task (minimal scope, nothing to simplify)
- All tasks were skipped/failed (nothing to review)

## Workflow Completion

After the Finalize phase (or after skipping it), present the appropriate summary:

The Workflow Completion summary is the final artifact the user sees. It must give a **complete picture** — not just pass/fail, but what was built, what decisions were made, and what needs attention.

Build the summary by reading `04-implementation-log.md`, the manifest, and `git diff --stat` from the branch point.

### All tasks passed:
```
⏸ Implementation Complete: {slug}
═════════════════════════════════════════════════════════

Overview:
  {2-3 sentence description of what was built end-to-end}

Tasks: {N}/{N} completed
─────────────────────────────────────────────────────────
  ✅ Task 1: {title}
     Files: {list of key files created/modified}
     Commit: {hash} — {message}

  ✅ Task 2: {title}
     Files: {list of key files created/modified}
     Commit: {hash} — {message}

  ...

Finalize:
─────────────────────────────────────────────────────────
  Holistic review: {CLEAN or N issues found and fixed}
  Simplification: {applied — N files changed / skipped}
  Tests: {total count} passing, 0 failing
  Commit: {hash if applied}

Metrics:
─────────────────────────────────────────────────────────
  Files changed: {N}  |  Lines added: {+N}  |  Lines removed: {-N}
  Total commits: {N} (+ 1 simplify if applied)
  Retries: {total retry count across all tasks, or "none"}
  Branch: {branch name}

You can:
  → merge          — merge to main
  → pr             — create a pull request
  → keep           — keep the branch as-is
═════════════════════════════════════════════════════════
```

### Some tasks failed or were skipped:
```
⚠ Implementation Partially Complete: {slug}
═════════════════════════════════════════════════════════

Overview:
  {2-3 sentence description of what was completed and what wasn't}

Tasks: {done_count}/{total} completed | {failed_count} failed | {skipped_count} skipped
─────────────────────────────────────────────────────────
  ✅ Task 1: {title}
     Files: {list of key files created/modified}
     Commit: {hash} — {message}

  ❌ Task 3: {title}
     Failed at: {agent} after {retry_count} retries
     Reason: {failure_reason}
     Last agent outputs: {brief summary of what Coder produced before failure}

  ⏭ Task 4: {title}
     Skipped: {reason — user chose to skip after failure}

  ...

⚠ Requires Attention:
─────────────────────────────────────────────────────────
  - Task 3 ({title}): {what needs to happen — e.g., "circular dependency
    needs architectural resolution before retry"}
  - Task 4 ({title}): {why it was skipped and impact on the feature}
  - {any dependent tasks that may be affected by failures}

Finalize:
─────────────────────────────────────────────────────────
  Holistic review: {result — applied to completed tasks only}
  Simplification: {result}
  Tests: {count} passing, {count} failing (if any)

Metrics:
─────────────────────────────────────────────────────────
  Files changed: {N}  |  Lines added: {+N}  |  Lines removed: {-N}
  Completed commits: {done_count}
  Total retries: {count}
  Branch: {branch name}

You can:
  → retry-failed   — re-attempt failed/skipped tasks
  → pr             — create PR with completed work only
  → keep           — keep the branch as-is for manual fixes
  → abort          — discard all changes
═════════════════════════════════════════════════════════
```

## Manifest Update

- Set implement phase status to `in_progress` when starting
- Set to `approved` with `completed_at` after all tasks complete
- **Before dispatching an agent**: Update the task's `status` to `active`, set `current_agent` to the agent name, set agent's status to `active`
- **After agent completes**: Update agent's status to `passed` or `failed`, clear `current_agent` (or set to next agent)
- **After all agents pass**: Set task `status` to `done`, record `commit` hash
- These updates keep `manifest.json` in sync with the dashboard and console progress table
