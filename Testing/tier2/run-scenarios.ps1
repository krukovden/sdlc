# Testing/tier2/run-scenarios.ps1
#
# Discovers and runs tier2 scenario tests.
#
# Usage:
#   pwsh Testing/tier2/run-scenarios.ps1                              # all scenarios
#   pwsh Testing/tier2/run-scenarios.ps1 -Scenario scenario-1-consistency  # specific scenario
[CmdletBinding()]
param(
    [string]$Scenario
)

$ErrorActionPreference = "Stop"
$scriptDir = $PSScriptRoot

# Discover scenarios: any subfolder containing scenario.json
$scenarioDirs = Get-ChildItem -Path $scriptDir -Directory |
    Where-Object { Test-Path (Join-Path $_.FullName "scenario.json") } |
    Sort-Object Name

if ($Scenario) {
    $scenarioDirs = $scenarioDirs | Where-Object { $_.Name -eq $Scenario }
    if ($scenarioDirs.Count -eq 0) {
        throw "Scenario not found: $Scenario. Available: $(
            (Get-ChildItem -Path $scriptDir -Directory |
                Where-Object { Test-Path (Join-Path $_.FullName "scenario.json") } |
                ForEach-Object { $_.Name }) -join ', '
        )"
    }
}

Write-Host ""
Write-Host "========================================"
Write-Host " Tier 2 Scenario Runner"
Write-Host " Scenarios: $($scenarioDirs.Count)"
Write-Host "========================================"

$results = @()

foreach ($dir in $scenarioDirs) {
    $config = Get-Content (Join-Path $dir.FullName "scenario.json") -Raw | ConvertFrom-Json
    $runScript = Join-Path $dir.FullName "run.ps1"

    if (-not (Test-Path $runScript)) {
        Write-Warning "Skipping $($dir.Name): no run.ps1 found"
        $results += @{ Name = $config.name; Status = "SKIPPED" }
        continue
    }

    Write-Host "`n>>> Running: $($config.name) ($($dir.Name))"

    try {
        & $runScript
        $results += @{ Name = $config.name; Status = "PASSED" }
    }
    catch {
        Write-Error "Scenario failed: $($dir.Name)`n$($_.Exception.Message)"
        $results += @{ Name = $config.name; Status = "FAILED"; Error = $_.Exception.Message }
    }
}

# Summary
Write-Host "`n========================================"
Write-Host " Summary"
Write-Host "========================================"
foreach ($r in $results) {
    $icon = switch ($r.Status) {
        "PASSED"  { "[PASS]" }
        "FAILED"  { "[FAIL]" }
        "SKIPPED" { "[SKIP]" }
    }
    Write-Host "  $icon $($r.Name)"
}

$failed = ($results | Where-Object { $_.Status -eq "FAILED" }).Count
if ($failed -gt 0) {
    Write-Host "`n$failed scenario(s) failed."
    exit 1
}

Write-Host "`nAll scenarios passed."
exit 0
