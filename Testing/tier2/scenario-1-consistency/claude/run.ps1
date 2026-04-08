# Testing/tier2/scenario-1-consistency/claude/run.ps1
#
# Runs the Claude tool for Scenario 1 (Consistency Test).
# Reads scenario.json from parent directory.
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

Write-Host "`n--- $tool ---"

$workspace = New-ScenarioWorkspace `
    -ScenarioDir (Resolve-Path "$PSScriptRoot\..") `
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

Write-Host "  $tool completed successfully"
