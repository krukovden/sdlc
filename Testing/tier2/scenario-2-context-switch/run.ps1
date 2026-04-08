# Testing/tier2/scenario-2-context-switch/run.ps1
[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"

# Load shared library
. "$PSScriptRoot\..\lib\Setup-Workspace.ps1"
. "$PSScriptRoot\..\lib\Invoke-Tool.ps1"
. "$PSScriptRoot\..\lib\Assert-Workflow.ps1"

# Read config
$config = Get-Content "$PSScriptRoot\scenario.json" -Raw | ConvertFrom-Json

Write-Host ""
Write-Host "=========================================="
Write-Host " Scenario: $($config.name)"
Write-Host " Workflow: $($config.workflow)"
Write-Host " Task:     $($config.task)"
Write-Host " Handoff:  $($config.handoff.from) -> $($config.handoff.to) after $($config.handoff.after)"
Write-Host "=========================================="

# Phase 1: Tool A runs early phases
$toolA = $config.handoff.from
Write-Host "`n--- $toolA (phases: $($config.phases.$toolA -join ', ')) ---"

$workspaceA = New-ScenarioWorkspace `
    -ScenarioDir $PSScriptRoot `
    -Tool $toolA `
    -Workflow $config.workflow

$resultA = Invoke-SdlcTool `
    -Tool $toolA `
    -Workspace $workspaceA `
    -Task $config.task `
    -Workflow $config.workflow `
    -StopAt $config.handoff.after `
    -Timeout $config.timeout

Assert-ValidWorkflow `
    -WorkspaceDir $workspaceA `
    -WorkflowType $config.workflow `
    -Phases $config.phases.$toolA

# Phase 2: Tool B picks up
$toolB = $config.handoff.to
Write-Host "`n--- $toolB (phases: $($config.phases.$toolB -join ', ')) ---"

$workspaceB = New-ScenarioWorkspace `
    -ScenarioDir $PSScriptRoot `
    -Tool $toolB `
    -Workflow $config.workflow

# Copy artifacts from Tool A to Tool B
$sourceWorkflows = Join-Path $workspaceA "docs\workflows"
$destWorkflows = Join-Path $workspaceB "docs\workflows"

if (Test-Path $sourceWorkflows) {
    New-Item -ItemType Directory -Path $destWorkflows -Force | Out-Null
    Copy-Item -Path "$sourceWorkflows\*" -Destination $destWorkflows -Recurse -Force
    Write-Host "  Copied artifacts from $toolA to $toolB workspace"
}
else {
    throw "No docs/workflows/ found in $toolA workspace: $workspaceA"
}

# Resume workflow
$resultB = Invoke-SdlcTool `
    -Tool $toolB `
    -Workspace $workspaceB `
    -Resume `
    -Timeout $config.timeout

# Validate all phases are complete in Tool B's workspace
$allPhases = @()
$allPhases += $config.phases.$toolA
$allPhases += $config.phases.$toolB

Assert-ValidWorkflow `
    -WorkspaceDir $workspaceB `
    -WorkflowType $config.workflow `
    -Phases $allPhases

Write-Host "`n=========================================="
Write-Host " Scenario 2: PASSED"
Write-Host "=========================================="
