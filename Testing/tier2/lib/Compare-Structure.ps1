# Testing/tier2/lib/Compare-Structure.ps1

. "$PSScriptRoot\Assert-Workflow.ps1"

function Get-LatestRunDir {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string]$ScenarioDir,

        [Parameter(Mandatory)]
        [string]$Tool,

        [Parameter(Mandatory)]
        [string]$Workflow
    )

    $toolDir = Join-Path $ScenarioDir "Run" $Tool $Workflow
    if (-not (Test-Path $toolDir)) {
        throw "No runs found for $Tool/$Workflow at $toolDir"
    }

    $latest = Get-ChildItem -Path $toolDir -Directory |
        Sort-Object Name -Descending |
        Select-Object -First 1

    if (-not $latest) {
        throw "No run directories found in $toolDir"
    }

    return $latest.FullName
}

function Get-ArtifactFileList {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string]$WorkspaceDir
    )

    $workflowFolder = Get-WorkflowFolder -WorkflowsDir (Join-Path $WorkspaceDir "docs\workflows")
    if (-not $workflowFolder) {
        throw "No workflow folder found in $WorkspaceDir"
    }

    $files = @()
    Get-ChildItem -Path $workflowFolder -Recurse -File | ForEach-Object {
        $rel = $_.FullName.Substring($workflowFolder.Length + 1).Replace("\", "/")
        $files += $rel
    }

    return ($files | Sort-Object)
}

function Compare-ScenarioStructure {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string]$ScenarioDir,

        [Parameter(Mandatory)]
        [string[]]$Tools,

        [Parameter(Mandatory)]
        [string]$Workflow
    )

    Write-Host "`n==> Structural comparison across tools"

    # Collect file lists per tool
    $fileLists = @{}
    foreach ($tool in $Tools) {
        $runDir = Get-LatestRunDir -ScenarioDir $ScenarioDir -Tool $tool -Workflow $Workflow
        $fileLists[$tool] = Get-ArtifactFileList -WorkspaceDir $runDir
        Write-Host "  $tool : $($fileLists[$tool].Count) files"
    }

    # Build union of all files
    $allFiles = @()
    foreach ($tool in $Tools) {
        $allFiles += $fileLists[$tool]
    }
    $allFiles = $allFiles | Sort-Object -Unique

    # Check each tool has each file
    $mismatches = @()
    foreach ($file in $allFiles) {
        $presentIn = @()
        $missingFrom = @()
        foreach ($tool in $Tools) {
            if ($fileLists[$tool] -contains $file) {
                $presentIn += $tool
            }
            else {
                $missingFrom += $tool
            }
        }
        if ($missingFrom.Count -gt 0) {
            $mismatches += "  $file — present in [$($presentIn -join ', ')], missing from [$($missingFrom -join ', ')]"
        }
    }

    if ($mismatches.Count -gt 0) {
        $report = "Structural mismatches found:`n$($mismatches -join "`n")"
        Write-Warning $report
        throw $report
    }

    Write-Host "  All tools produced the same $($allFiles.Count) artifact files"
}
