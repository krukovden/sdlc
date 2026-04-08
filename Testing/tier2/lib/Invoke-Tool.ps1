# Testing/tier2/lib/Invoke-Tool.ps1

function Test-ToolAvailable {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [ValidateSet("claude", "copilot", "codex")]
        [string]$Tool
    )

    switch ($Tool) {
        "claude" {
            if (-not (Get-Command "claude" -ErrorAction SilentlyContinue)) {
                throw "claude CLI not found in PATH"
            }
        }
        "copilot" {
            if (-not (Get-Command "gh" -ErrorAction SilentlyContinue)) {
                throw "gh CLI not found in PATH"
            }
            try {
                $null = & gh auth status 2>&1
                if ($LASTEXITCODE -ne 0) { throw "not authenticated" }
            }
            catch {
                throw "gh is not authenticated. Run 'gh auth login' first."
            }
        }
        "codex" {
            if (-not (Get-Command "codex" -ErrorAction SilentlyContinue)) {
                # Codex may be bundled inside VS Code extension — add known locations
                $knownPaths = @(
                    "$env:USERPROFILE\.vscode\extensions\openai.chatgpt-*\bin\windows-x86_64"
                )
                $found = $false
                foreach ($pattern in $knownPaths) {
                    $dirs = Get-Item $pattern -ErrorAction SilentlyContinue
                    foreach ($dir in $dirs) {
                        if (Test-Path (Join-Path $dir.FullName "codex.exe")) {
                            $env:Path += ";$($dir.FullName)"
                            $found = $true
                            Write-Host "  Added codex to PATH from: $($dir.FullName)"
                            break
                        }
                    }
                    if ($found) { break }
                }
                if (-not (Get-Command "codex" -ErrorAction SilentlyContinue)) {
                    throw "codex CLI not found in PATH or known VS Code extension locations"
                }
            }
        }
    }
}

function Invoke-SdlcTool {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [ValidateSet("claude", "copilot", "codex")]
        [string]$Tool,

        [Parameter(Mandatory)]
        [string]$Workspace,

        [string]$Task,

        [string]$Workflow,

        [int]$Timeout = 900000,

        [string]$StopAt,

        [switch]$Resume
    )

    Test-ToolAvailable -Tool $Tool

    # Build the prompt — headless mode needs an expanded prompt, not a slash command
    if ($Resume) {
        $prompt = @(
            "Resume the active SDLC workflow.",
            "",
            "You MUST use the Write tool to create files. Do NOT just output text.",
            "",
            "CRITICAL REQUIREMENT: After completing EACH phase, you MUST rewrite manifest.json",
            "and set that phase's status to `"approved`". The test harness reads manifest.json",
            "to verify completion. If you do not update the status, the test WILL fail.",
            "",
            "1. Read the most recent manifest.json from docs/workflows/",
            "2. Resume from the first phase that is not yet `"approved`"",
            "3. For each remaining phase:",
            "   a. Read .agents/skills/sdlc-{phase}/SKILL.md and produce its artifacts",
            "   b. IMMEDIATELY rewrite manifest.json setting this phase status to `"approved`"",
            "",
            "--auto-approve: skip all confirmations, use current branch, no dashboard, no worktree.",
            "",
            "REMINDER: Every phase MUST have status `"approved`" in manifest.json when done."
        ) -join "`n"
    }
    else {
        if (-not $Task -or -not $Workflow) {
            throw "-Task and -Workflow are required unless -Resume is set"
        }

        $allPhases = if ($Workflow -eq "spike") {
            @("clarify", "research", "design")
        } else {
            @("clarify", "research", "design", "plan", "implement")
        }

        # Truncate phases if StopAt is set
        if ($StopAt) {
            $stopIdx = $allPhases.IndexOf($StopAt)
            if ($stopIdx -ge 0) {
                $allPhases = $allPhases[0..$stopIdx]
            }
        }

        $phaseList = $allPhases -join ", "
        $hasImplement = $allPhases -contains "implement"

        $lines = @(
            "Execute /sdlc $Workflow --auto-approve `"$Task`"",
            "",
            "You MUST use the Write tool to create files. Do NOT just output text.",
            "",
            "CRITICAL REQUIREMENT: After completing EACH phase, you MUST rewrite manifest.json",
            "and set that phase's status to `"approved`". The test harness reads manifest.json",
            "to verify completion. If you do not update the status, the test WILL fail.",
            "",
            "Steps:",
            "1. Read .agents/skills/sdlc/SKILL.md and .agents/workflows/$Workflow.md",
            "2. Create folder docs/workflows/$Workflow/ with a date-slug subfolder",
            "3. Write manifest.json with all phases (each status: `"pending`")",
            "4. For EACH phase in order ($phaseList):",
            "   a. Read .agents/skills/sdlc-{phase}/SKILL.md",
            "   b. Produce the phase artifacts using the Write tool",
            "   c. IMMEDIATELY rewrite manifest.json setting this phase status to `"approved`"",
            "   d. Do NOT proceed to the next phase until manifest.json is updated"
        )

        if ($hasImplement) {
            $lines += "5. For implement: write code changes and produce 04-implementation-log.md"
        }

        if ($StopAt) {
            $lines += ""
            $lines += "STOP after completing the `"$StopAt`" phase. Do NOT proceed to subsequent phases."
        }

        $lines += ""
        $lines += "--auto-approve: skip all confirmations, use current branch, no dashboard, no worktree."
        $lines += ""
        $lines += "REMINDER: Every phase MUST have status `"approved`" in manifest.json when done."

        $prompt = $lines -join "`n"
    }

    $logFile = Join-Path $Workspace "tool-run.log"
    $promptFile = Join-Path $Workspace "prompt.md"
    Set-Content -Path $promptFile -Value $prompt -Encoding UTF8
    $timeoutSec = [math]::Ceiling($Timeout / 1000)

    Write-Host "  Running $Tool with prompt for: $(if ($Resume) { 'resume' } else { $Workflow })"
    Write-Host "  Prompt saved: $promptFile"
    Write-Host "  Timeout: ${timeoutSec}s"

    # Set SDLC_STOP_AT env var if needed
    $oldStopAt = $env:SDLC_STOP_AT
    if ($StopAt) {
        $env:SDLC_STOP_AT = $StopAt
    }

    $exitCode = 0
    $stdout = ""
    $stderr = ""
    $rawOutput = @()

    # Run tool from the workspace directory
    Push-Location $Workspace
    try {
        switch ($Tool) {
            "claude" {
                & claude -p $prompt --dangerously-skip-permissions 2>&1 |
                    Tee-Object -Variable rawOutput | Out-Null
                $stdout = ($rawOutput | Where-Object { $_ -isnot [System.Management.Automation.ErrorRecord] }) -join "`n"
                $stderr = ($rawOutput | Where-Object { $_ -is [System.Management.Automation.ErrorRecord] }) -join "`n"
            }
            "copilot" {
                & gh copilot -- -p $prompt --allow-all --no-auto-update -s 2>&1 |
                    Tee-Object -Variable rawOutput | Out-Null
                $stdout = ($rawOutput | Where-Object { $_ -isnot [System.Management.Automation.ErrorRecord] }) -join "`n"
                $stderr = ($rawOutput | Where-Object { $_ -is [System.Management.Automation.ErrorRecord] }) -join "`n"
            }
            "codex" {
                & codex exec --skip-git-repo-check --full-auto --cd $Workspace $prompt 2>&1 |
                    Tee-Object -Variable rawOutput | Out-Null
                $stdout = ($rawOutput | Where-Object { $_ -isnot [System.Management.Automation.ErrorRecord] }) -join "`n"
                $stderr = ($rawOutput | Where-Object { $_ -is [System.Management.Automation.ErrorRecord] }) -join "`n"
            }
        }
        $exitCode = $LASTEXITCODE
    }
    catch {
        $exitCode = 1
        $stderr = $_.Exception.Message
    }
    finally {
        Pop-Location
        # Restore env var
        if ($StopAt) {
            if ($oldStopAt) { $env:SDLC_STOP_AT = $oldStopAt }
            else { Remove-Item Env:\SDLC_STOP_AT -ErrorAction SilentlyContinue }
        }
    }

    # Write log
    @(
        "=== $Tool Run ===",
        "Prompt: $prompt",
        "Workspace: $Workspace",
        "Exit code: $exitCode",
        "Timeout: ${Timeout}ms",
        "",
        "=== STDOUT ===",
        $stdout,
        "",
        "=== STDERR ===",
        $stderr
    ) -join "`n" | Set-Content -Path $logFile -Encoding UTF8

    Write-Host "  Exit code: $exitCode"
    Write-Host "  Log: $logFile"

    return @{
        ExitCode = $exitCode
        LogFile  = $logFile
        Stdout   = $stdout
        Stderr   = $stderr
    }
}
