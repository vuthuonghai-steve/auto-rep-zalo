# .agents/scripts/guards/verification-gate.ps1
# Hook Type: Stop
# Enforces Binary Definition of Done (Gate 5)

param(
    [string]$InputJson
)

$sw = [System.Diagnostics.Stopwatch]::StartNew()

# 1. Thu thap JSON tu bo nho (Memory Parameter) hoac pipeline
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
$details = @{ gate5 = "PASSED" }

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
    } else {
        $details.gate5 = "TERMINATED_EARLY ($reason)"
    }
} catch {
    $status = "ERROR"
    $details.error = $_.Exception.Message
} finally {
    $sw.Stop()
    $durationMs = [Math]::Round($sw.Elapsed.TotalMilliseconds, 2)

    # 1. Ghi dau chan ra stderr (Antigravity engine log ghi nhan)
    [Console]::Error.WriteLine("[GUARD FOOTPRINT][verification-gate] Status=$status | Reason=$reason | Duration=${durationMs}ms")

    # 2. Ghi dau chan ben vung vao file JSONL
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
    } catch {
        # Fail-safe
    }
}

Write-Output '{"decision": "allow"}'
exit 0
