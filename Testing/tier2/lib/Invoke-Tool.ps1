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
                throw "codex CLI not found in PATH"
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

    # Build the command string
    if ($Resume) {
        $command = "/sdlc:resume"
    }
    else {
        if (-not $Task -or -not $Workflow) {
            throw "-Task and -Workflow are required unless -Resume is set"
        }
        $command = "/sdlc $Workflow `"$Task`""
    }

    $logFile = Join-Path $Workspace "tool-run.log"
    $timeoutSec = [math]::Ceiling($Timeout / 1000)

    Write-Host "  Running $Tool with command: $command"
    Write-Host "  Timeout: ${timeoutSec}s"

    # Build env with optional SDLC_STOP_AT
    $env = @{}
    if ($StopAt) {
        $env["SDLC_STOP_AT"] = $StopAt
    }

    $exitCode = 0
    $stdout = ""
    $stderr = ""

    try {
        switch ($Tool) {
            "claude" {
                $result = & claude -p $command --dangerously-skip-permissions 2>&1 |
                    Tee-Object -Variable rawOutput
                $stdout = ($rawOutput | Where-Object { $_ -isnot [System.Management.Automation.ErrorRecord] }) -join "`n"
                $stderr = ($rawOutput | Where-Object { $_ -is [System.Management.Automation.ErrorRecord] }) -join "`n"
            }
            "copilot" {
                $result = & gh copilot -- -p $command --allow-all --no-auto-update -s 2>&1 |
                    Tee-Object -Variable rawOutput
                $stdout = ($rawOutput | Where-Object { $_ -isnot [System.Management.Automation.ErrorRecord] }) -join "`n"
                $stderr = ($rawOutput | Where-Object { $_ -is [System.Management.Automation.ErrorRecord] }) -join "`n"
            }
            "codex" {
                $result = & codex exec --skip-git-repo-check --sandbox workspace-write --ask-for-approval never --cd $Workspace $command 2>&1 |
                    Tee-Object -Variable rawOutput
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

    # Write log
    @(
        "=== $Tool Run ===",
        "Command: $command",
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
