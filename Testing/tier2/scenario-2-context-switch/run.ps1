# Testing/tier2/scenario-2-context-switch/run.ps1
#
# Scenario 2: Context Switching Test.
# Creates ONE shared workspace, runs each tool in sequence.
# Each tool picks up sdlc-doc/workflows/ from where the previous one stopped.
# Validates: all phases approved, all required artifacts exist.
[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"

# Load shared library
. "$PSScriptRoot\..\lib\Setup-Workspace.ps1"
. "$PSScriptRoot\..\lib\Invoke-Tool.ps1"
. "$PSScriptRoot\..\lib\Assert-Workflow.ps1"

# Read config
$config = Get-Content "$PSScriptRoot\scenario.json" -Raw | ConvertFrom-Json

$toolChain = ($config.steps | ForEach-Object { "$($_.tool)($($_.phases -join ','))" }) -join " -> "

Write-Host ""
Write-Host "=========================================="
Write-Host " Scenario: $($config.name)"
Write-Host " Workflow: $($config.workflow)"
Write-Host " Task:     $($config.task)"
Write-Host " Chain:    $toolChain"
Write-Host "=========================================="

# Create a single shared workspace with all platform configs
$workspace = New-SharedWorkspace `
    -ScenarioDir $PSScriptRoot `
    -Workflow $config.workflow

# Run each tool in sequence from the same workspace
$allPhases = @()
$isFirst = $true

foreach ($step in $config.steps) {
    $tool   = $step.tool
    $phases = @($step.phases)
    $allPhases += $phases

    Write-Host "`n--- $tool (phases: $($phases -join ', ')) ---"

    if ($isFirst) {
        Invoke-SdlcTool `
            -Tool $tool `
            -Workspace $workspace `
            -Task $config.task `
            -Workflow $config.workflow `
            -StopAt $step.stopAt `
            -Timeout $config.timeout
        $isFirst = $false
    }
    else {
        $invokeArgs = @{
            Tool      = $tool
            Workspace = $workspace
            Resume    = $true
            Timeout   = $config.timeout
        }
        if ($step.stopAt) { $invokeArgs.StopAt = $step.stopAt }
        Invoke-SdlcTool @invokeArgs
    }

    # Validate phases completed so far
    Assert-ValidWorkflow `
        -WorkspaceDir $workspace `
        -WorkflowType $config.workflow `
        -Phases $allPhases

    Write-Host "  $tool completed successfully"
}

# Cleanup build artifacts
foreach ($junk in @("node_modules", "dist", "package-lock.json")) {
    $junkPath = Join-Path $workspace $junk
    if (Test-Path $junkPath) {
        Remove-Item $junkPath -Recurse -Force
    }
}

Write-Host "`n=========================================="
Write-Host " Scenario 2: PASSED"
Write-Host "=========================================="
