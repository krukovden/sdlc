# Testing/tier2/lib/Setup-Workspace.ps1

function New-SharedWorkspace {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string]$ScenarioDir,

        [Parameter(Mandatory)]
        [ValidateSet("feature", "bugfix", "refactor", "spike")]
        [string]$Workflow
    )

    $repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..\..")
    $projectDir = Join-Path $ScenarioDir "project"
    $binPath = Join-Path $repoRoot "bin\sdlc.js"

    if (-not (Test-Path $projectDir)) {
        throw "Project folder not found: $projectDir. Each scenario must have its own project/ directory."
    }

    # Create Run/<workflow>/<timestamp>/ — single shared folder, no per-tool subdirs
    $timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
    $runDir = Join-Path $ScenarioDir "Run" $Workflow $timestamp

    New-Item -ItemType Directory -Path $runDir -Force | Out-Null

    # Copy scenario's project files into workspace
    Get-ChildItem -Path $projectDir -Exclude "node_modules" |
        Copy-Item -Destination $runDir -Recurse -Force

    # Run sdlc init for all platforms so any tool can work from this folder
    Push-Location $runDir
    try {
        $null = & node $binPath init all 2>&1
        if ($LASTEXITCODE -ne 0) {
            throw "sdlc init all failed with exit code $LASTEXITCODE"
        }
    }
    finally {
        Pop-Location
    }

    Write-Host "  Shared workspace created: $runDir"
    return $runDir
}

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
    $projectDir = Join-Path $ScenarioDir "project"
    $binPath = Join-Path $repoRoot "bin\sdlc.js"

    if (-not (Test-Path $projectDir)) {
        throw "Project folder not found: $projectDir. Each scenario must have its own project/ directory."
    }

    # Create Run/<tool>/<workflow>/<timestamp>/
    $timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
    $runDir = Join-Path $ScenarioDir "Run" $Tool $Workflow $timestamp

    New-Item -ItemType Directory -Path $runDir -Force | Out-Null

    # Copy scenario's project files into workspace
    Get-ChildItem -Path $projectDir -Exclude "node_modules" |
        Copy-Item -Destination $runDir -Recurse -Force

    # Run sdlc init
    Push-Location $runDir
    try {
        $null = & node $binPath init $Tool 2>&1
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
