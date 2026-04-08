# Testing/tier2/lib/Compare-Content.ps1

. "$PSScriptRoot\Compare-Structure.ps1"

function Compare-ScenarioContent {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string]$ScenarioDir,

        [Parameter(Mandatory)]
        [string[]]$Tools,

        [Parameter(Mandatory)]
        [string]$Workflow,

        [Parameter(Mandatory)]
        [ValidateSet("claude", "copilot", "codex")]
        [string]$CompareWith
    )

    Write-Host "`n==> AI-powered content comparison using $CompareWith"

    # Collect artifacts from each tool
    $artifactContents = @{}
    foreach ($tool in $Tools) {
        $runDir = Get-LatestRunDir -ScenarioDir $ScenarioDir -Tool $tool -Workflow $Workflow
        $workflowFolder = Get-WorkflowFolder -WorkflowsDir (Join-Path $runDir "docs\workflows")
        if (-not $workflowFolder) {
            throw "No workflow folder found for $tool in $runDir"
        }

        $content = ""
        Get-ChildItem -Path $workflowFolder -Recurse -File | ForEach-Object {
            $rel = $_.FullName.Substring($workflowFolder.Length + 1).Replace("\", "/")
            $fileContent = Get-Content $_.FullName -Raw -ErrorAction SilentlyContinue
            $content += "`n--- $rel ---`n$fileContent`n"
        }
        $artifactContents[$tool] = $content
    }

    # Build comparison prompt
    $sections = ""
    foreach ($tool in $Tools) {
        $sections += "`n=== ARTIFACTS FROM: $($tool.ToUpper()) ===`n$($artifactContents[$tool])`n"
    }

    $prompt = @"
Compare these SDLC workflow artifacts produced by different AI tools for the same task.

The same task was given to each tool: run an SDLC $Workflow workflow.

$sections

Analyze and report:
1. Are the artifacts consistent in scope and completeness?
2. Which tool produced the most thorough output?
3. Are there any significant differences in approach or quality?
4. Rate each tool's output on a scale of 1-5 for: completeness, clarity, actionability.

Be concise. Use a table for ratings.
"@

    # Invoke the compareWith tool
    $timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
    $reportPath = Join-Path $ScenarioDir "Run" "comparison-$timestamp.md"

    Write-Host "  Sending comparison prompt to $CompareWith..."

    $report = ""
    switch ($CompareWith) {
        "claude" {
            $report = & claude -p $prompt --dangerously-skip-permissions 2>&1
        }
        "copilot" {
            $report = & gh copilot -- -p $prompt --allow-all --no-auto-update -s 2>&1
        }
        "codex" {
            $report = & codex exec --skip-git-repo-check --sandbox workspace-write --ask-for-approval never $prompt 2>&1
        }
    }

    $reportContent = @(
        "# Cross-Tool Comparison Report",
        "",
        "**Generated:** $timestamp",
        "**Tools:** $($Tools -join ', ')",
        "**Workflow:** $Workflow",
        "**Compared with:** $CompareWith",
        "",
        "---",
        "",
        ($report -join "`n")
    ) -join "`n"

    # Ensure Run/ directory exists
    $runDir = Join-Path $ScenarioDir "Run"
    if (-not (Test-Path $runDir)) {
        New-Item -ItemType Directory -Path $runDir -Force | Out-Null
    }

    Set-Content -Path $reportPath -Value $reportContent -Encoding UTF8

    Write-Host "  Comparison report: $reportPath"
    return $reportPath
}
