# Testing/tier2/scenario-1-consistency/run.ps1
#
# Orchestrator for Scenario 1: Consistency Test.
# Calls each tool's run.ps1, then runs cross-tool comparison.
[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"

# Load shared library (for comparison functions)
. "$PSScriptRoot\..\lib\Compare-Structure.ps1"
. "$PSScriptRoot\..\lib\Compare-Content.ps1"

# Read config
$config = Get-Content "$PSScriptRoot\scenario.json" -Raw | ConvertFrom-Json

Write-Host ""
Write-Host "=========================================="
Write-Host " Scenario: $($config.name)"
Write-Host " Workflow: $($config.workflow)"
Write-Host " Task:     $($config.task)"
Write-Host " Tools:    $($config.tools -join ', ')"
Write-Host "=========================================="

# Phase 1: Run each tool via its own script
foreach ($tool in $config.tools) {
    $toolScript = Join-Path $PSScriptRoot $tool "run.ps1"
    if (-not (Test-Path $toolScript)) {
        throw "Tool script not found: $toolScript"
    }
    & $toolScript
}

# Phase 2: Cross-tool structural comparison
Compare-ScenarioStructure `
    -ScenarioDir $PSScriptRoot `
    -Tools $config.tools `
    -Workflow $config.workflow

# Phase 3: AI-powered content comparison
if ($config.compareWith) {
    $report = Compare-ScenarioContent `
        -ScenarioDir $PSScriptRoot `
        -Tools $config.tools `
        -Workflow $config.workflow `
        -CompareWith $config.compareWith
}

Write-Host "`n=========================================="
Write-Host " Scenario 1: PASSED"
Write-Host "=========================================="
