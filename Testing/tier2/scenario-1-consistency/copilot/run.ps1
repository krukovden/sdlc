# Testing/tier2/scenario-1-consistency/copilot/run.ps1
#
# Runs the Copilot tool for Scenario 1 (Consistency Test).
# Reads scenario.json from parent directory for defaults.
# Pass -Task to override the task from scenario.json.
#
# Usage:
#   pwsh Testing/tier2/scenario-1-consistency/copilot/run.ps1
#   pwsh Testing/tier2/scenario-1-consistency/copilot/run.ps1 -Task "my custom task"
#   pwsh Testing/tier2/scenario-1-consistency/copilot/run.ps1 -Task "fix bug" -Workflow bugfix
#   pwsh Testing/tier2/scenario-1-consistency/copilot/run.ps1 -Task "explore" -Workflow spike -StopAt design
#   pwsh Testing/tier2/scenario-1-consistency/copilot/run.ps1 -SkipValidation
[CmdletBinding()]
param(
    [Parameter(Mandatory = $false)]
    [string]$Task,

    [Parameter(Mandatory = $false)]
    [ValidateSet("feature", "bugfix", "refactor", "spike")]
    [string]$Workflow,

    [Parameter(Mandatory = $false)]
    [string]$StopAt,

    [Parameter(Mandatory = $false)]
    [int]$Timeout,

    [Parameter(Mandatory = $false)]
    [switch]$SkipValidation
)

$ErrorActionPreference = "Stop"

# Load shared library
. "$PSScriptRoot\..\..\lib\Setup-Workspace.ps1"
. "$PSScriptRoot\..\..\lib\Invoke-Tool.ps1"
. "$PSScriptRoot\..\..\lib\Assert-Workflow.ps1"

# Read scenario config from parent (always loaded for defaults)
$config = Get-Content "$PSScriptRoot\..\scenario.json" -Raw | ConvertFrom-Json
$tool = "copilot"

# Override from params or fall back to scenario.json
$effectiveTask     = if ($Task)     { $Task }     else { $config.task }
$effectiveWorkflow = if ($Workflow) { $Workflow } else { $config.workflow }
$effectiveTimeout  = if ($Timeout)  { $Timeout }  else { $config.timeout }

Write-Host "`n--- $tool ---"
Write-Host "  Task:     $effectiveTask"
Write-Host "  Workflow: $effectiveWorkflow"
if ($StopAt) { Write-Host "  StopAt:   $StopAt" }

$workspace = New-ScenarioWorkspace `
    -ScenarioDir (Resolve-Path "$PSScriptRoot\..") `
    -Tool $tool `
    -Workflow $effectiveWorkflow

$invokeArgs = @{
    Tool      = $tool
    Workspace = $workspace
    Task      = $effectiveTask
    Workflow  = $effectiveWorkflow
    Timeout   = $effectiveTimeout
}
if ($StopAt) { $invokeArgs.StopAt = $StopAt }

$result = Invoke-SdlcTool @invokeArgs

if (-not $SkipValidation) {
    $phases = if ($effectiveWorkflow -eq "spike") {
        @("clarify", "research", "design")
    }
    else {
        $config.phases.$tool
    }

    # Truncate phases if StopAt is set
    if ($StopAt -and $phases) {
        $stopIdx = $phases.IndexOf($StopAt)
        if ($stopIdx -ge 0) {
            $phases = $phases[0..$stopIdx]
        }
    }

    Assert-ValidWorkflow `
        -WorkspaceDir $workspace `
        -WorkflowType $effectiveWorkflow `
        -Phases $phases

    Write-Host "  $tool completed successfully"
}
else {
    Write-Host "  $tool completed (validation skipped)"
    Write-Host "  Workspace: $workspace"
}
