# Testing/tier2/lib/Setup-Workspace.ps1

function New-ScenarioWorkspace {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string]$ScenarioDir,

        [Parameter(Mandatory)]
        [ValidateSet("claude", "copilot", "codex")]
        [string]$Tool,

        [Parameter(Mandatory)]
        [ValidateSet("feature", "bugfix", "refactor", "spike")]
        [string]$Workflow
    )

    $repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..\..")
    $fixtureDir = Join-Path $repoRoot "Testing\fixtures\test-project"
    $binPath = Join-Path $repoRoot "bin\sdlc.js"

    if (-not (Test-Path $fixtureDir)) {
        throw "Fixture project not found: $fixtureDir"
    }

    # Create Run/<tool>/<workflow>/<timestamp>/
    $timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
    $runDir = Join-Path $ScenarioDir "Run" $Tool $Workflow $timestamp

    New-Item -ItemType Directory -Path $runDir -Force | Out-Null

    # Copy fixture project
    Copy-Item -Path (Join-Path $fixtureDir "*") -Destination $runDir -Recurse -Force

    # Run sdlc init
    Push-Location $runDir
    try {
        & node $binPath init $Tool
        if ($LASTEXITCODE -ne 0) {
            throw "sdlc init $Tool failed with exit code $LASTEXITCODE"
        }
    }
    finally {
        Pop-Location
    }

    Write-Host "  Workspace created: $runDir"
    return $runDir
}
