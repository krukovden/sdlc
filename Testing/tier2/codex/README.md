# Codex Tier 2 Manual Runner

`codex` Tier 2 is kept separate from `node --test` because the Codex CLI run depends on an interactive-capable environment and backend connectivity that may be blocked in sandboxed test execution.

## What This Runner Does

1. Creates a dedicated workspace directly under `Testing/tier2/codex/<workflow>-<slug>-<timestamp>/`
2. Copies the fixture project from `Testing/fixtures/test-project/`
3. Runs `init codex` into that workspace using the repository's `bin/sdlc.js`
4. Starts the requested workflow through `codex exec`
5. Validates that the workflow generated the required artifacts

## Run It

From the repository root:

```powershell
pwsh -File .\Testing\tier2\codex\run-workflow.ps1
```

Optional parameters:

```powershell
pwsh -File .\Testing\tier2\codex\run-workflow.ps1 -WorkflowType feature -TaskDescription 'add POST /echo endpoint that returns the request body'
pwsh -File .\Testing\tier2\codex\run-workflow.ps1 -WorkflowType bugfix -TaskDescription 'GET /health returns 500 when no DB connection'
pwsh -File .\Testing\tier2\codex\run-workflow.ps1 -WorkflowType spike -TaskDescription 'evaluate logging libraries for Node.js'
pwsh -File .\Testing\tier2\codex\run-workflow.ps1 -RunName my-custom-run
pwsh -File .\Testing\tier2\codex\run-workflow.ps1 -KeepWorkspace
```

## Output Location

Workspace:

```text
Testing/tier2/codex/<workflow>-<slug>-<timestamp>/
```

Workflow artifacts:

```text
Testing/tier2/codex/<run-name>/docs/workflows/<workflow>/<date>-<slug>/
```

## Preconditions

- `node` is installed and available in `PATH`
- `codex` is installed and available in `PATH`
- the current environment allows Codex CLI to reach its backend

## Notes

- This runner uses the repository's `bin/sdlc.js` directly, so it does not copy `.agents/`, `bin/`, or `setup.js` into the workspace.
- The workspace contains only the fixture project plus generated `.codex/`, `.gitignore`, and `docs/workflows/` artifacts.
- The default workspace name includes both the workflow type and a timestamp, so repeated runs do not overwrite each other.
