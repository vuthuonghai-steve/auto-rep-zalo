# .agents/scripts/guards/verification-gate.ps1
# Hook Type: Stop
# Enforces Binary Definition of Done (Gate 5) & Release Mode Quality Gate (Hybrid XML-YAML Architecture)

param(
    [string]$InputJson
)

$sw = [System.Diagnostics.Stopwatch]::StartNew()

# 1. Thu thap JSON tu bo nho hoac pipeline
if (-not $InputJson -and $input) {
    $InputJson = ($input | Out-String).Trim()
}

# 2. Fallback stdin khi chay qua Engine CLI cua Antigravity
if (-not $InputJson -and [Console]::IsInputRedirected) {
    try {
        $InputJson = [Console]::In.ReadToEnd().Trim()
    } catch {
        $InputJson = ""
    }
}

if (-not $InputJson) {
    Write-Output '{"decision": "allow"}'
    exit 0
}

$status = "ALLOW"
$reason = $null
$details = @{
    gate5 = "PASSED"
    xml_yaml_hybrid = "SKIPPED"
    mixed_payload = "SKIPPED"
    clickable_links = "SKIPPED"
    ai_first_format = "SKIPPED"
}
$decision = "allow"
$denyExplanation = $null

try {
    if ($InputJson -match '(\{[\s\S]*\})') {
        $InputJson = $matches[1]
    }
    $payload = $InputJson | ConvertFrom-Json
    $reason = $payload.terminationReason
    $details.terminationReason = $reason
    $details.executionNum = $payload.executionNum

    # Neu agent dung vi hoan thanh binh thuong (NO_TOOL_CALL)
    if ($reason -eq "NO_TOOL_CALL") {
        [Console]::Error.WriteLine("[VERIFICATION GATE] Hoàn tất phiên làm việc. Xác thực cổng Definition of Done thành công.")
        
        $responseText = if ($payload.response) { $payload.response } else { "" }
        $guardsDir = $PSScriptRoot

        if ($responseText) {
            # 1. Hybrid XML-YAML Guard
            $hybridScript = Join-Path $guardsDir "xml-yaml-hybrid-guard.ps1"
            if (Test-Path $hybridScript) {
                try {
                    $hybOut = & $hybridScript -InputText $responseText | ConvertFrom-Json
                    $details.xml_yaml_hybrid = $hybOut.status
                } catch { $details.xml_yaml_hybrid = "ERROR" }
            }

            # 2. Mixed Payload Boundary Guard
            $mixedScript = Join-Path $guardsDir "mixed-payload-guard.ps1"
            if (Test-Path $mixedScript) {
                try {
                    $mpOut = & $mixedScript -InputText $responseText | ConvertFrom-Json
                    $details.mixed_payload = $mpOut.status
                } catch { $details.mixed_payload = "ERROR" }
            }

            # 3. Clickable Links Guard
            $linkScript = Join-Path $guardsDir "clickable-links-guard.ps1"
            if (Test-Path $linkScript) {
                try {
                    $clOut = & $linkScript -InputText $responseText | ConvertFrom-Json
                    $details.clickable_links = $clOut.status
                } catch { $details.clickable_links = "ERROR" }
            }
        }

        # 4. Dual-Channel Gate Channel 1: AI-First Triad Format Verifier (specs/** va Docs/**)
        $verifyScript = [System.IO.Path]::GetFullPath((Join-Path $guardsDir "..\..\skills\ai-first-doc-formatter\scripts\verify-ai-first-format.py"))
        if (Test-Path $verifyScript) {
            $repoRoot = [System.IO.Path]::GetFullPath((Join-Path $guardsDir "..\..\.."))
            $changedFiles = @()

            try {
                $porcelain = & git status --porcelain 2>$null
                if ($porcelain) {
                    foreach ($line in ($porcelain -split "`r?`n")) {
                        if ($line -match '^[ MADRCU?!]{2}\s+(.*)$') {
                            $p = $matches[1].Trim('"').Trim()
                            if ($p -match '->\s*(.*)$') { $p = $matches[1].Trim('"').Trim() }
                            if ($p) { $changedFiles += $p }
                        }
                    }
                }
                $committedDiff = & git diff --name-only HEAD~1 2>$null
                if ($committedDiff) {
                    foreach ($line in ($committedDiff -split "`r?`n")) {
                        $p = $line.Trim('"').Trim()
                        if ($p) { $changedFiles += $p }
                    }
                }
            } catch {}

            $changedFiles = $changedFiles | Select-Object -Unique

            # Diff Scope Isolation (EC-001): Chi loc specs/** va docs/** (.md), loai tru docs/archives/
            $inScopeDocs = @()
            foreach ($f in $changedFiles) {
                $norm = $f.Replace('\', '/').ToLowerInvariant()
                if (($norm.StartsWith("specs/") -or $norm.StartsWith("docs/")) -and $norm.EndsWith(".md")) {
                    if (-not $norm.StartsWith("docs/archives/")) {
                        $inScopeDocs += $f
                    }
                }
            }

            if ($inScopeDocs.Count -gt 0) {
                $failedDocs = @()
                $failureMessages = @()

                foreach ($doc in $inScopeDocs) {
                    $targetPath = [System.IO.Path]::GetFullPath((Join-Path $repoRoot $doc))
                    if (Test-Path $targetPath) {
                        $verifyOut = & python $verifyScript $targetPath 2>&1
                        $exitCode = $LASTEXITCODE
                        if ($exitCode -ne 0) {
                            $failedDocs += $doc
                            $outStr = ($verifyOut | Out-String).Trim()
                            $failureMessages += "[FAIL: $doc]`n$outStr"
                        }
                    }
                }

                if ($failedDocs.Count -gt 0) {
                    $status = "DENY"
                    $decision = "deny"
                    $details.ai_first_format = "FAILED"
                    $details.failed_files = $failedDocs
                    $denyExplanation = "Tài liệu đặc tả/kỹ thuật vi phạm chuẩn AI-First Triad (verify-ai-first-format.py):`n" + ($failureMessages -join "`n`n")
                    [Console]::Error.WriteLine("[VERIFICATION GATE][DENY] Phát hiện $($failedDocs.Count) tài liệu vi phạm chuẩn AI-First Triad.")
                } else {
                    $details.ai_first_format = "PASSED"
                }
            } else {
                $details.ai_first_format = "SKIPPED_NO_CHANGES"
            }
        } else {
            $details.ai_first_format = "SKIPPED_SCRIPT_NOT_FOUND"
        }
    } else {
        $details.gate5 = "TERMINATED_EARLY ($reason)"
    }
} catch {
    $status = "ERROR"
    $details.error = $_.Exception.Message
} finally {
    $sw.Stop()
    $durationMs = [Math]::Round($sw.Elapsed.TotalMilliseconds, 2)

    [Console]::Error.WriteLine("[GUARD FOOTPRINT][verification-gate] Status=$status | Reason=$reason | Duration=${durationMs}ms | Gates=$($details | ConvertTo-Json -Compress)")

    try {
        $logDir = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot "..\..\logs"))
        if (-not (Test-Path $logDir)) {
            New-Item -ItemType Directory -Path $logDir -Force | Out-Null
        }
        $logFile = Join-Path $logDir "guard-footprints.jsonl"
        $footprint = [ordered]@{
            timestamp  = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss.fff")
            guard      = "verification-gate"
            event      = "Stop"
            status     = $status
            target     = $reason
            durationMs = $durationMs
            details    = $details
        }
        $entryJson = $footprint | ConvertTo-Json -Compress
        [System.IO.File]::AppendAllLines($logFile, [string[]]@($entryJson), [System.Text.Encoding]::UTF8)
    } catch {}
}

if ($decision -eq "deny") {
    $denyObj = [ordered]@{
        decision = "deny"
        explanation = $denyExplanation
    }
    Write-Output ($denyObj | ConvertTo-Json -Compress)
} else {
    Write-Output '{"decision": "allow"}'
}
exit 0
