# Testing/tier2/scenario-2-context-switch/run.ps1
#
# Orchestrator for Scenario 2: Context Switching Test.
# Calls handoff.from tool first, then handoff.to tool (which picks up artifacts).
[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"

# Read config
$config = Get-Content "$PSScriptRoot\scenario.json" -Raw | ConvertFrom-Json

Write-Host ""
Write-Host "=========================================="
Write-Host " Scenario: $($config.name)"
Write-Host " Workflow: $($config.workflow)"
Write-Host " Task:     $($config.task)"
Write-Host " Handoff:  $($config.handoff.from) -> $($config.handoff.to) after $($config.handoff.after)"
Write-Host "=========================================="

# Phase 1: Run source tool (early phases)
$fromScript = Join-Path $PSScriptRoot $config.handoff.from "run.ps1"
if (-not (Test-Path $fromScript)) {
    throw "Tool script not found: $fromScript"
}
& $fromScript

# Phase 2: Run target tool (resumes from source artifacts)
$toScript = Join-Path $PSScriptRoot $config.handoff.to "run.ps1"
if (-not (Test-Path $toScript)) {
    throw "Tool script not found: $toScript"
}
& $toScript

Write-Host "`n=========================================="
Write-Host " Scenario 2: PASSED"
Write-Host "=========================================="
