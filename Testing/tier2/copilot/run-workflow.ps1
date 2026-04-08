[CmdletBinding()]
param(
    [ValidateSet("feature", "bugfix", "refactor", "spike")]
    [string]$WorkflowType = "feature",
    [string]$TaskDescription = "add POST /echo endpoint that returns the request body",
    [string]$RunName,
    [switch]$KeepWorkspace
)

$ErrorActionPreference = "Stop"

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

function Require-Command {
    param([string]$Name)

    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "Required command not found in PATH: $Name"
    }
}

function Assert-GhAuth {
    try {
        $null = & gh auth status 2>&1
        if ($LASTEXITCODE -ne 0) { throw "not authenticated" }
    }
    catch {
        throw "gh is not authenticated. Run 'gh auth login' first."
    }
}

function New-Slug {
    param([string]$Value)

    $slug = $Value.ToLowerInvariant()
    $slug = [regex]::Replace($slug, "[^a-z0-9]+", "-")
    $slug = [regex]::Replace($slug, "-{2,}", "-").Trim("-")

    if ([string]::IsNullOrWhiteSpace($slug)) {
        return "workflow"
    }

    if ($slug.Length -gt 48) {
        return $slug.Substring(0, 48).Trim("-")
    }

    return $slug
}

function Get-WorkflowFolder {
    param([string]$WorkflowsDir)

    if (-not (Test-Path $WorkflowsDir)) {
        return $null
    }

    $manifest = Get-ChildItem -Path $WorkflowsDir -Filter manifest.json -Recurse -File |
        Sort-Object LastWriteTimeUtc -Descending |
        Select-Object -First 1

    if (-not $manifest) {
        return $null
    }

    return $manifest.Directory.FullName
}

function Assert-FileExists {
    param([string]$Path)

    if (-not (Test-Path $Path)) {
        throw "Required artifact not found: $Path"
    }
}

function Get-RequiredArtifacts {
    param([string]$WorkflowType)

    switch ($WorkflowType) {
        "feature" {
            return @(
                "00-clarify.md",
                "01-research.md",
                "02-design\architecture-diagrams.md",
                "02-design\architecture-decisions.md",
                "02-design\api-contracts.md",
                "02-design\storage-model.md",
                "02-design\testing-strategy.md",
                "02-design\standard-verifications.md",
                "03-plan.md",
                "04-implementation-log.md"
            )
        }
        "bugfix" {
            return @(
                "00-clarify.md",
                "01-research.md",
                "02-design\root-cause-analysis.md",
                "02-design\fix-strategy.md",
                "02-design\regression-test-plan.md",
                "02-design\standard-verifications.md",
                "03-plan.md",
                "04-implementation-log.md"
            )
        }
        "refactor" {
            return @(
                "00-clarify.md",
                "01-research.md",
                "02-design\target-architecture.md",
                "02-design\migration-plan.md",
                "02-design\regression-test-plan.md",
                "02-design\standard-verifications.md",
                "03-plan.md",
                "04-implementation-log.md"
            )
        }
        "spike" {
            return @(
                "00-clarify.md",
                "01-research.md",
                "02-design\options-analysis.md",
                "02-design\recommendation.md"
            )
        }
    }
}

function Assert-ValidWorkflow {
    param(
        [string]$WorkspaceDir,
        [string]$WorkflowType
    )

    $workflowFolder = Get-WorkflowFolder -WorkflowsDir (Join-Path $WorkspaceDir "docs\workflows")
    if (-not $workflowFolder) {
        throw "No workflow folder with manifest.json was found under docs/workflows"
    }

    $manifestPath = Join-Path $workflowFolder "manifest.json"
    $manifest = Get-Content $manifestPath -Raw | ConvertFrom-Json

    $expectedPhases = if ($WorkflowType -eq "spike") {
        @("clarify", "research", "design")
    } else {
        @("clarify", "research", "design", "plan", "implement")
    }
    $allowedStatuses = @("approved", "done", "completed", "complete")

    foreach ($phase in $expectedPhases) {
        if (-not $manifest.phases.$phase) {
            throw "Missing phase in manifest: $phase"
        }

        $status = $manifest.phases.$phase.status
        if ($status -notin $allowedStatuses) {
            throw "Phase '$phase' is '$status', expected one of: $($allowedStatuses -join ', ')"
        }
    }

    foreach ($artifact in (Get-RequiredArtifacts -WorkflowType $WorkflowType)) {
        Assert-FileExists (Join-Path $workflowFolder $artifact)
    }

    return @{
        WorkflowFolder = $workflowFolder
        ManifestPath   = $manifestPath
    }
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

$scriptDir  = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot   = Resolve-Path (Join-Path $scriptDir "..\..\..")
$fixtureDir = Join-Path $repoRoot "Testing\fixtures\test-project"
$slug       = New-Slug -Value $TaskDescription
$timestamp  = Get-Date -Format "yyyyMMdd-HHmmss"
$effectiveRunName = if ($RunName) { $RunName } else { "$WorkflowType-$slug-$timestamp" }
$workspaceDir = Join-Path $scriptDir $effectiveRunName
$binPath    = Join-Path $repoRoot "bin\sdlc.js"
$promptPath = Join-Path $workspaceDir "copilot-$WorkflowType.prompt.md"

Require-Command node
Require-Command gh
Assert-GhAuth

if (-not (Test-Path $fixtureDir)) {
    throw "Fixture project not found: $fixtureDir"
}

if (Test-Path $workspaceDir) {
    if ($KeepWorkspace) {
        throw "Workspace already exists and -KeepWorkspace was supplied: $workspaceDir"
    }

    Remove-Item -Recurse -Force $workspaceDir
}

New-Item -ItemType Directory -Path $workspaceDir -Force | Out-Null
Copy-Item -Path (Join-Path $fixtureDir "*") -Destination $workspaceDir -Recurse -Force

Push-Location $workspaceDir
try {
    Write-Host ""
    Write-Host "==> Initializing Copilot workspace"
    & node $binPath init copilot
    if ($LASTEXITCODE -ne 0) {
        throw "init copilot failed with exit code $LASTEXITCODE"
    }

    $phaseList = if ($WorkflowType -eq "spike") {
        "clarify, research, design"
    } else {
        "clarify, research, design, plan, implement"
    }

    $implementLine = if ($WorkflowType -eq "spike") {
        ""
    } else {
        "7. For implement: write code changes and produce 04-implementation-log.md"
    }

    $prompt = @"
Execute /sdlc $WorkflowType --auto-approve "$TaskDescription"

You MUST use the Write tool to create files. Do NOT just output text.

Steps:
1. Read .agents/skills/sdlc/SKILL.md and .agents/workflows/$WorkflowType.md
2. Create folder docs/workflows/$WorkflowType/ with a date-slug subfolder
3. Write manifest.json with all phases
4. Execute each phase: $phaseList
5. For each phase, read .agents/skills/sdlc-{phase}/SKILL.md and produce its artifacts using the Write tool
6. Update manifest.json status to "approved" after each phase
$implementLine

--auto-approve: skip all confirmations, use current branch, no dashboard, no worktree.
"@

    Set-Content -Path $promptPath -Value $prompt -Encoding UTF8

    Write-Host ""
    Write-Host "==> Running Copilot $WorkflowType workflow"
    Write-Host "    Prompt saved to: $promptPath"
    & gh copilot -- -p $prompt --allow-all --no-auto-update -s 2>&1 | Tee-Object -Variable copilotOutput
    if ($LASTEXITCODE -ne 0) {
        Write-Warning "Copilot CLI exited with code $LASTEXITCODE"
    }

    Write-Host ""
    Write-Host "==> Validating generated artifacts"
    $validation = Assert-ValidWorkflow -WorkspaceDir $workspaceDir -WorkflowType $WorkflowType

    Write-Host ""
    Write-Host "Copilot Tier 2 manual run passed."
    Write-Host "Workspace: $workspaceDir"
    Write-Host "Prompt:    $promptPath"
    Write-Host "Workflow:  $($validation.WorkflowFolder)"
    Write-Host "Manifest:  $($validation.ManifestPath)"
}
finally {
    Pop-Location
}
