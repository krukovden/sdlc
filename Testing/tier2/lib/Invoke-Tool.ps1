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
            if (-not (Get-Command "copilot" -ErrorAction SilentlyContinue)) {
                throw "copilot CLI not found in PATH. Install via: npm install -g @github/copilot"
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

    # Build the prompt — minimal, the SDLC skills handle the rest
    if ($Resume) {
        $prompt = "/sdlc:resume --auto-approve"
        if ($StopAt) {
            $prompt += " --stop-at $StopAt"
        }
    }
    else {
        if (-not $Task -or -not $Workflow) {
            throw "-Task and -Workflow are required unless -Resume is set"
        }

        $prompt = "/sdlc $Workflow --auto-approve `"$Task`""
        if ($StopAt) {
            $prompt += " --stop-at $StopAt"
        }
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
                # Call copilot directly (not via 'gh copilot') to avoid
                # argument-splitting issues with multi-line prompts.
                & copilot -p $prompt --allow-all --no-auto-update --silent 2>&1 |
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
