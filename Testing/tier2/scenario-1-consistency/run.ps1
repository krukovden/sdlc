# Testing/tier2/scenario-1-consistency/run.ps1
#
# Scenario 1: Consistency Test.
# Runs each tool independently with the same task.
# Validates: all phases approved, all required artifacts exist, same structure across tools.
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
Write-Host " Tools:    $($config.tools -join ', ')"
Write-Host "=========================================="

# Phase 1: Run each tool and validate
$fileLists = @{}

foreach ($tool in $config.tools) {
    Write-Host "`n--- $tool ---"

    $workspace = New-ScenarioWorkspace `
        -ScenarioDir $PSScriptRoot `
        -Tool $tool `
        -Workflow $config.workflow

    Invoke-SdlcTool `
        -Tool $tool `
        -Workspace $workspace `
        -Task $config.task `
        -Workflow $config.workflow `
        -Timeout $config.timeout

    # Validate all phases approved + all artifacts exist
    Assert-ValidWorkflow `
        -WorkspaceDir $workspace `
        -WorkflowType $config.workflow `
        -Phases $config.phases.$tool

    # Collect artifact file list for cross-tool comparison
    $workflowFolder = Get-WorkflowFolder -WorkflowsDir (Join-Path $workspace "sdlc-doc\workflows")
    $files = @()
    Get-ChildItem -Path $workflowFolder -Recurse -File | ForEach-Object {
        $rel = $_.FullName.Substring($workflowFolder.Length + 1).Replace("\", "/")
        $files += $rel
    }
    $fileLists[$tool] = ($files | Sort-Object)

    Write-Host "  $tool : $($files.Count) artifact files"

    # Cleanup build artifacts
    foreach ($junk in @("node_modules", "dist", "package-lock.json")) {
        $junkPath = Join-Path $workspace $junk
        if (Test-Path $junkPath) {
            Remove-Item $junkPath -Recurse -Force
        }
    }

    Write-Host "  $tool completed successfully"
}

# Phase 2: Compare file structure across tools
Write-Host "`n==> Structural comparison"

$allFiles = @()
foreach ($tool in $config.tools) { $allFiles += $fileLists[$tool] }
$allFiles = $allFiles | Sort-Object -Unique

$mismatches = @()
foreach ($file in $allFiles) {
    $missing = @()
    foreach ($tool in $config.tools) {
        if ($fileLists[$tool] -notcontains $file) { $missing += $tool }
    }
    if ($missing.Count -gt 0) {
        $mismatches += "  $file — missing from: $($missing -join ', ')"
    }
}

if ($mismatches.Count -gt 0) {
    throw "Structural mismatches:`n$($mismatches -join "`n")"
}

Write-Host "  All tools produced the same $($allFiles.Count) artifact files"

Write-Host "`n=========================================="
Write-Host " Scenario 1: PASSED"
Write-Host "=========================================="
