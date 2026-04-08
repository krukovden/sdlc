# Testing/tier2/scenario-1-consistency/run.ps1
[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"

# Load shared library
. "$PSScriptRoot\..\lib\Setup-Workspace.ps1"
. "$PSScriptRoot\..\lib\Invoke-Tool.ps1"
. "$PSScriptRoot\..\lib\Assert-Workflow.ps1"
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

# Phase 1: Run each tool
$workspaces = @{}
foreach ($tool in $config.tools) {
    Write-Host "`n--- $tool ---"

    $workspace = New-ScenarioWorkspace `
        -ScenarioDir $PSScriptRoot `
        -Tool $tool `
        -Workflow $config.workflow

    $result = Invoke-SdlcTool `
        -Tool $tool `
        -Workspace $workspace `
        -Task $config.task `
        -Workflow $config.workflow `
        -Timeout $config.timeout

    $phases = $config.phases.$tool
    Assert-ValidWorkflow `
        -WorkspaceDir $workspace `
        -WorkflowType $config.workflow `
        -Phases $phases

    $workspaces[$tool] = $workspace
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
