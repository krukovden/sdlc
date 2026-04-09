# Testing/tier2/lib/Assert-Workflow.ps1

function Get-WorkflowFolder {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string]$WorkflowsDir
    )

    if (-not (Test-Path $WorkflowsDir)) {
        return $null
    }

    $manifest = Get-ChildItem -Path $WorkflowsDir -Filter manifest.json -Recurse -File |
        Sort-Object LastWriteTimeUtc -Descending |
        Select-Object -First 1

    if (-not $manifest) {
        return $null
    }

    return $manifest.Directory.FullName
}

function Get-RequiredArtifacts {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string]$WorkflowType
    )

    switch ($WorkflowType) {
        "feature" {
            return @(
                "00-clarify.md",
                "01-research.md",
                "02-design\architecture-diagrams.md",
                "02-design\architecture-decisions.md",
                "02-design\api-contracts.md",
                "02-design\storage-model.md",
                "02-design\testing-strategy.md",
                "02-design\standard-verifications.md",
                "03-plan.md",
                "04-implementation-log.md"
            )
        }
        "bugfix" {
            return @(
                "00-clarify.md",
                "01-research.md",
                "02-design\root-cause-analysis.md",
                "02-design\fix-strategy.md",
                "02-design\regression-test-plan.md",
                "02-design\standard-verifications.md",
                "03-plan.md",
                "04-implementation-log.md"
            )
        }
        "refactor" {
            return @(
                "00-clarify.md",
                "01-research.md",
                "02-design\target-architecture.md",
                "02-design\migration-plan.md",
                "02-design\regression-test-plan.md",
                "02-design\standard-verifications.md",
                "03-plan.md",
                "04-implementation-log.md"
            )
        }
        "spike" {
            return @(
                "00-clarify.md",
                "01-research.md",
                "02-design\options-analysis.md",
                "02-design\recommendation.md"
            )
        }
    }
}

function Assert-ValidWorkflow {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string]$WorkspaceDir,

        [Parameter(Mandatory)]
        [ValidateSet("feature", "bugfix", "refactor", "spike")]
        [string]$WorkflowType,

        [string[]]$Phases
    )

    $workflowFolder = Get-WorkflowFolder -WorkflowsDir (Join-Path $WorkspaceDir "docs\workflows")
    if (-not $workflowFolder) {
        throw "No workflow folder with manifest.json was found under docs/workflows"
    }

    $manifestPath = Join-Path $workflowFolder "manifest.json"
    $manifest = Get-Content $manifestPath -Raw | ConvertFrom-Json

    # Default phases if not specified
    if (-not $Phases) {
        $Phases = if ($WorkflowType -eq "spike") {
            @("clarify", "research", "design")
        }
        else {
            @("clarify", "research", "design", "plan", "implement")
        }
    }

    $allowedStatuses = @("approved", "done", "completed", "complete")

    foreach ($phase in $Phases) {
        if (-not $manifest.phases.$phase) {
            throw "Missing phase in manifest: $phase"
        }

        $status = $manifest.phases.$phase.status
        if (-not $status) {
            $status = $manifest.phases.$phase
        }
        if ($status -notin $allowedStatuses) {
            throw "Phase '$phase' is '$status', expected one of: $($allowedStatuses -join ', ')"
        }
    }

    # Artifact validation — filter to only phases we're checking
    $allArtifacts = Get-RequiredArtifacts -WorkflowType $WorkflowType
    $phaseArtifactPrefixes = @{
        "clarify"   = "00-"
        "research"  = "01-"
        "design"    = "02-"
        "plan"      = "03-"
        "implement" = "04-"
    }

    $expectedArtifacts = @()
    foreach ($artifact in $allArtifacts) {
        foreach ($phase in $Phases) {
            $prefix = $phaseArtifactPrefixes[$phase]
            if ($artifact.StartsWith($prefix)) {
                $expectedArtifacts += $artifact
            }
        }
    }

    # Collect actual files for fuzzy matching
    $actualFiles = @()
    Get-ChildItem -Path $workflowFolder -Recurse -File | ForEach-Object {
        $rel = $_.FullName.Substring($workflowFolder.Length + 1)
        $actualFiles += $rel
    }

    $missing = @()
    foreach ($artifact in $expectedArtifacts) {
        $exactPath = Join-Path $workflowFolder $artifact
        if (Test-Path $exactPath) { continue }

        # Fuzzy match: check if any actual file contains the expected stem
        # Searches any directory — some tools nest files in subdirectories
        # (e.g. 00-clarify/00-clarify.md instead of 00-clarify.md)
        $stem = [System.IO.Path]::GetFileNameWithoutExtension($artifact)
        $fuzzy = $actualFiles | Where-Object {
            $fName = [System.IO.Path]::GetFileNameWithoutExtension($_)
            $fName -like "*$stem*"
        }

        if (-not $fuzzy) {
            $missing += $artifact
        }
    }

    if ($missing.Count -gt 0) {
        throw "Missing artifacts:`n  $($missing -join "`n  ")`nActual files:`n  $($actualFiles -join "`n  ")"
    }

    Write-Host "  Validation passed: $($Phases -join ', ')"
    return @{
        WorkflowFolder = $workflowFolder
        ManifestPath   = $manifestPath
    }
}
