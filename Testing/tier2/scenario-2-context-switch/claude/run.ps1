# Testing/tier2/scenario-2-context-switch/claude/run.ps1
#
# Runs Claude for Scenario 2 (Context Switching).
# Claude runs early phases and stops after the handoff point.
# Can be run standalone or called by the scenario orchestrator.
[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"

# Load shared library
. "$PSScriptRoot\..\..\lib\Setup-Workspace.ps1"
. "$PSScriptRoot\..\..\lib\Invoke-Tool.ps1"
. "$PSScriptRoot\..\..\lib\Assert-Workflow.ps1"

# Read scenario config from parent
$config = Get-Content "$PSScriptRoot\..\scenario.json" -Raw | ConvertFrom-Json
$tool = "claude"

Write-Host "`n--- $tool (phases: $($config.phases.$tool -join ', ')) ---"

$workspace = New-ScenarioWorkspace `
    -ScenarioDir (Resolve-Path "$PSScriptRoot\..") `
    -Tool $tool `
    -Workflow $config.workflow

$result = Invoke-SdlcTool `
    -Tool $tool `
    -Workspace $workspace `
    -Task $config.task `
    -Workflow $config.workflow `
    -StopAt $config.handoff.after `
    -Timeout $config.timeout

Assert-ValidWorkflow `
    -WorkspaceDir $workspace `
    -WorkflowType $config.workflow `
    -Phases $config.phases.$tool

Write-Host "  $tool completed successfully (stopped after $($config.handoff.after))"
