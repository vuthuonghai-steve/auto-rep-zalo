<#
.SYNOPSIS
    Adversarial Red-Team Test Harness Runner for AI-First Doc Formatter
.DESCRIPTION
    Runs adversarial red-team test cases against verify-ai-first-format.py,
    emulates/triggers Antigravity headless validation, extracts drift rate,
    and returns deterministic PASS/FAIL binary exit code.
#>

[CmdletBinding()]
param (
    [string]$VerifierScript = ".agents/skills/ai-first-doc-formatter/scripts/verify-ai-first-format.py",
    [string]$TestCasesDir = "evals/doc-formatter-redteam/test-cases"
)

$ErrorActionPreference = "Stop"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " [Doc-Formatter Red-Team] Starting Adversarial Harness Run" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

if (-not (Test-Path $VerifierScript)) {
    Write-Error "Verifier script not found at: $VerifierScript"
    exit 1
}

if (-not (Test-Path $TestCasesDir)) {
    Write-Error "Test cases directory not found at: $TestCasesDir"
    exit 1
}

$testFiles = Get-ChildItem -Path $TestCasesDir -Filter "*.md" | Sort-Object Name
if ($testFiles.Count -eq 0) {
    Write-Error "No red-team test cases found in $TestCasesDir"
    exit 1
}

$totalTests = $testFiles.Count
$caughtAttacks = 0
$telemetryResults = @()

foreach ($file in $testFiles) {
    $filePath = $file.FullName
    Write-Host "`n[*] Executing Red-Team Test: $($file.Name)" -ForegroundColor Yellow
    
    # Run Python verifier
    $pythonCmd = "python `"$VerifierScript`" `"$filePath`""
    $output = Invoke-Expression $pythonCmd 2>&1
    $exitCode = $LASTEXITCODE

    # Red-team test cases are adversarial attacks designed to fail the verifier (Exit Code 1 = Caught/Neutralized)
    if ($exitCode -eq 1) {
        Write-Host "  [SHIELD ACTIVATED] Attack successfully intercepted and neutralized." -ForegroundColor Green
        Write-Host "  [Proof Output]:" -ForegroundColor DarkGray
        $output | ForEach-Object { Write-Host "    $_" -ForegroundColor DarkGray }
        $caughtAttacks++
        $telemetryResults += [PSCustomObject]@{
            TestCase = $file.Name
            Status = "CAUGHT"
            ExitCode = $exitCode
            Details = ($output -join "; ")
        }
    } else {
        Write-Host "  [VULNERABILITY DETECTED] Adversarial payload bypassed verifier! Exit Code: $exitCode" -ForegroundColor Red
        $telemetryResults += [PSCustomObject]@{
            TestCase = $file.Name
            Status = "BYPASSED"
            ExitCode = $exitCode
            Details = ($output -join "; ")
        }
    }
}

$driftCount = $totalTests - $caughtAttacks
$driftRate = [math]::Round(($driftCount / $totalTests) * 100, 2)

Write-Host "`n==========================================================" -ForegroundColor Cyan
Write-Host " [Doc-Formatter Red-Team] Harness Summary Telemetry" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "Total Red-Team Vectors : $totalTests"
Write-Host "Intercepted Attacks    : $caughtAttacks"
Write-Host "Bypassed Attacks       : $driftCount"
Write-Host "Attack Drift Rate      : $driftRate %"

if ($driftCount -eq 0) {
    Write-Host "`n[RESULT] RED-TEAM HARNESS PASS: All adversarial vectors were deterministically blocked. (Exit Code: 0)" -ForegroundColor Green
    exit 0
} else {
    Write-Host "`n[RESULT] RED-TEAM HARNESS FAIL: Drift Rate > 0%. Vulnerabilities present. (Exit Code: 1)" -ForegroundColor Red
    exit 1
}
