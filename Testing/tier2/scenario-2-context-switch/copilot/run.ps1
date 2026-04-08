# Testing/tier2/scenario-2-context-switch/copilot/run.ps1
#
# Runs Copilot for Scenario 2 (Context Switching).
# Copilot receives artifacts from the handoff tool and resumes the workflow.
# Must be run after claude/run.ps1 has completed.
# Can be run standalone (if Claude artifacts exist) or called by the orchestrator.
[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"

# Load shared library
. "$PSScriptRoot\..\..\lib\Setup-Workspace.ps1"
. "$PSScriptRoot\..\..\lib\Invoke-Tool.ps1"
. "$PSScriptRoot\..\..\lib\Assert-Workflow.ps1"
. "$PSScriptRoot\..\..\lib\Compare-Structure.ps1"

# Read scenario config from parent
$config = Get-Content "$PSScriptRoot\..\scenario.json" -Raw | ConvertFrom-Json
$tool = "copilot"
$fromTool = $config.handoff.from

Write-Host "`n--- $tool (phases: $($config.phases.$tool -join ', ')) ---"

# Find the latest run from the handoff source tool
$sourceRunDir = Get-LatestRunDir `
    -ScenarioDir (Resolve-Path "$PSScriptRoot\..") `
    -Tool $fromTool `
    -Workflow $config.workflow

$sourceWorkflows = Join-Path $sourceRunDir "docs\workflows"
if (-not (Test-Path $sourceWorkflows)) {
    throw "No docs/workflows/ found in $fromTool workspace: $sourceRunDir. Run $fromTool first."
}

# Create workspace and copy artifacts from source tool
$workspace = New-ScenarioWorkspace `
    -ScenarioDir (Resolve-Path "$PSScriptRoot\..") `
    -Tool $tool `
    -Workflow $config.workflow

$destWorkflows = Join-Path $workspace "docs\workflows"
New-Item -ItemType Directory -Path $destWorkflows -Force | Out-Null
Copy-Item -Path "$sourceWorkflows\*" -Destination $destWorkflows -Recurse -Force
Write-Host "  Copied artifacts from $fromTool to $tool workspace"

# Resume workflow
$result = Invoke-SdlcTool `
    -Tool $tool `
    -Workspace $workspace `
    -Resume `
    -Timeout $config.timeout

# Validate all phases (both source and this tool's phases)
$allPhases = @()
$allPhases += $config.phases.$fromTool
$allPhases += $config.phases.$tool

Assert-ValidWorkflow `
    -WorkspaceDir $workspace `
    -WorkflowType $config.workflow `
    -Phases $allPhases

Write-Host "  $tool completed successfully (resumed from $fromTool)"
