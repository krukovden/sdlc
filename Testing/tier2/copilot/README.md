# Copilot Tier 2 Manual Runner

Copilot Tier 2 is kept separate from `node --test` because the Copilot CLI run depends on GitHub authentication, an interactive-capable environment, and backend connectivity that may be blocked in sandboxed test execution.

## What This Runner Does

1. Creates a dedicated workspace directly under `Testing/tier2/copilot/<workflow>-<slug>-<timestamp>/`
2. Copies the fixture project from `Testing/fixtures/test-project/`
3. Runs `init copilot` into that workspace using the repository's `bin/sdlc.js`
4. Starts the requested workflow through `gh copilot -- -p`
5. Validates that the workflow generated the required artifacts

## Run It

From the repository root:

```powershell
pwsh -File .\Testing\tier2\copilot\run-workflow.ps1
```

Optional parameters:

```powershell
pwsh -File .\Testing\tier2\copilot\run-workflow.ps1 -WorkflowType feature -TaskDescription 'add POST /echo endpoint that returns the request body'
pwsh -File .\Testing\tier2\copilot\run-workflow.ps1 -WorkflowType bugfix -TaskDescription 'GET /health returns 500 when no DB connection'
pwsh -File .\Testing\tier2\copilot\run-workflow.ps1 -WorkflowType spike -TaskDescription 'evaluate logging libraries for Node.js'
pwsh -File .\Testing\tier2\copilot\run-workflow.ps1 -RunName my-custom-run
pwsh -File .\Testing\tier2\copilot\run-workflow.ps1 -KeepWorkspace
```

## Output Location

Workspace:

```text
Testing/tier2/copilot/<workflow>-<slug>-<timestamp>/
```

Workflow artifacts:

```text
Testing/tier2/copilot/<run-name>/docs/workflows/<workflow>/<date>-<slug>/
```

## Preconditions

- `node` is installed and available in `PATH`
- `gh` CLI is installed and available in `PATH`
- `gh auth login` has been run (the runner verifies auth before starting)
- The Copilot CLI extension is installed (`gh copilot -- --version` works)
- The current environment allows the Copilot CLI to reach its backend

## Copilot Chat (Manual Alternative)

If you prefer to run the workflow interactively inside VS Code Copilot Chat or the Copilot CLI REPL instead of through the automated script:

### 1. Prepare a workspace

```powershell
$workspace = "Testing\tier2\copilot\manual-$(Get-Date -Format yyyyMMdd-HHmmss)"
New-Item -ItemType Directory $workspace -Force | Out-Null
Copy-Item Testing\fixtures\test-project\* $workspace -Recurse
Push-Location $workspace
node ..\..\..\..\bin\sdlc.js init copilot
```

### 2. Open in Copilot Chat

Open the workspace folder in VS Code, then paste the following into Copilot Chat (replace `feature` and the description as needed):

```
Execute /sdlc feature --auto-approve "add POST /echo endpoint that returns the request body"

You MUST use the Write tool to create files. Do NOT just output text.

Steps:
1. Read .agents/skills/sdlc/SKILL.md and .agents/workflows/feature.md
2. Create folder docs/workflows/feature/ with a date-slug subfolder
3. Write manifest.json with all phases
4. Execute each phase: clarify, research, design, plan, implement
5. For each phase, read .agents/skills/sdlc-{phase}/SKILL.md and produce its artifacts using the Write tool
6. Update manifest.json status to "approved" after each phase
7. For implement: write code changes and produce 04-implementation-log.md

--auto-approve: skip all confirmations, use current branch, no dashboard, no worktree.
```

### 3. Validate

After execution completes, verify the artifacts exist:

```powershell
$folder = Get-ChildItem docs\workflows -Filter manifest.json -Recurse | Select-Object -First 1
Get-Content $folder.FullName | ConvertFrom-Json | Select-Object -ExpandProperty phases
Get-ChildItem $folder.Directory.FullName -Recurse -File | Select-Object FullName
```

## Notes

- This runner uses the repository's `bin/sdlc.js` directly, so it does not copy `.agents/`, `bin/`, or `setup.js` into the workspace.
- The workspace contains only the fixture project plus generated `.github/`, `.gitignore`, and `docs/workflows/` artifacts.
- The default workspace name includes both the workflow type and a timestamp, so repeated runs do not overwrite each other.
- Unlike Claude and Codex, the Copilot CLI is invoked via the `gh copilot` proxy. The `--` separator passes flags directly to the underlying Copilot binary.
