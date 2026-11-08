# .agents/scripts/guards/placeholder-guard.ps1
# Hook Type: PostToolUse
# Target Tools: write_file, edit_file

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
    Write-Output "{}"
    exit 0
}

$status = "CLEAN"
$filePath = $null
$details = @{ violations = 0; matches = @() }

try {
    # Trich xuat chuoi JSON neu co chua ky tu du thua
    if ($InputJson -match '(\{[\s\S]*\})') {
        $InputJson = $matches[1]
    }
    $payload = $InputJson | ConvertFrom-Json
    $filePath = $payload.toolCall.args.Path

    if ($filePath -and (Test-Path $filePath)) {
        # Quet cac placeholder cam tren production flow
        $forbidden = Select-String -Path $filePath -Pattern "(TODO|FIXME|STUB_IMPLEMENTATION|fake_data|mock_response)" -SimpleMatch:$false
        if ($forbidden) {
            $status = "FLAGGED_PLACEHOLDER"
            $details.violations = $forbidden.Count
            $details.matches = @($forbidden | ForEach-Object { "Line $($_.LineNumber): $($_.Line.Trim())" })

            # Ghi canh bao ra stderr
            [Console]::Error.WriteLine("[GUARD WARNING] Phat hien $($forbidden.Count) placeholder trong $filePath :")
            foreach ($match in $forbidden) {
                [Console]::Error.WriteLine("  Line $($match.LineNumber): $($match.Line.Trim())")
            }
        }
    } else {
        $status = "SKIPPED_NOT_FOUND"
    }
} catch {
    $status = "ERROR"
    $details.error = $_.Exception.Message
} finally {
    $sw.Stop()
    $durationMs = [Math]::Round($sw.Elapsed.TotalMilliseconds, 2)

    # 1. Ghi dau chan ra stderr (Antigravity engine log ghi nhan)
    [Console]::Error.WriteLine("[GUARD FOOTPRINT][placeholder-guard] Status=$status | File=$filePath | Violations=$($details.violations) | Duration=${durationMs}ms")

    # 2. Ghi dau chan ben vung vao file JSONL
    try {
        $logDir = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot "..\..\logs"))
        if (-not (Test-Path $logDir)) {
            New-Item -ItemType Directory -Path $logDir -Force | Out-Null
        }
        $logFile = Join-Path $logDir "guard-footprints.jsonl"
        $footprint = [ordered]@{
            timestamp  = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss.fff")
            guard      = "placeholder-guard"
            event      = "PostToolUse"
            status     = $status
            target     = $filePath
            durationMs = $durationMs
            details    = $details
        }
        $entryJson = $footprint | ConvertTo-Json -Compress
        [System.IO.File]::AppendAllLines($logFile, [string[]]@($entryJson), [System.Text.Encoding]::UTF8)
    } catch {
        # Fail-safe
    }
}

Write-Output "{}"
exit 0
