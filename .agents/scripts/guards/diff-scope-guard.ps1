# .agents/scripts/guards/diff-scope-guard.ps1
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

$status = "IN_SCOPE"
$filePath = $null
$workspaceRoot = $null
$details = @{ inScope = $true }

try {
    if ($InputJson -match '(\{[\s\S]*\})') {
        $InputJson = $matches[1]
    }
    $payload = $InputJson | ConvertFrom-Json
    $filePath = $payload.toolCall.args.Path

    if ($filePath) {
        # Xac dinh thu muc goc cua Workspace
        if ($payload.workspacePaths -and $payload.workspacePaths.Count -gt 0) {
            $workspaceRoot = [System.IO.Path]::GetFullPath($payload.workspacePaths[0])
        } else {
            $current = (Get-Location).Path
            if ($current.EndsWith(".agents", [System.StringComparison]::OrdinalIgnoreCase)) {
                $workspaceRoot = (Get-Item $current).Parent.FullName
            } else {
                $workspaceRoot = $current
            }
        }

        $fullTarget = [System.IO.Path]::GetFullPath($filePath)
        $normalizedWorkspace = $workspaceRoot.TrimEnd([System.IO.Path]::DirectorySeparatorChar, [System.IO.Path]::AltDirectorySeparatorChar)
        $details.workspaceRoot = $normalizedWorkspace
        $details.resolvedPath = $fullTarget

        # Kiem tra file co nam trong pham vi workspace hay bi thoat ra ngoai (Blast Radius)
        $inWorkspace = $fullTarget.StartsWith($normalizedWorkspace + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase) -or
                       $fullTarget.Equals($normalizedWorkspace, [System.StringComparison]::OrdinalIgnoreCase)

        if (-not $inWorkspace) {
            $status = "OUT_OF_SCOPE"
            $details.inScope = $false
            [Console]::Error.WriteLine("[GUARD WARNING] File chỉnh sửa nằm ngoài workspace hiện tại: $fullTarget (Workspace: $normalizedWorkspace)")
        }
    } else {
        $status = "SKIPPED_NO_PATH"
    }
} catch {
    $status = "ERROR"
    $details.error = $_.Exception.Message
} finally {
    $sw.Stop()
    $durationMs = [Math]::Round($sw.Elapsed.TotalMilliseconds, 2)

    # 1. Ghi dau chan ra stderr (Antigravity engine log ghi nhan)
    [Console]::Error.WriteLine("[GUARD FOOTPRINT][diff-scope-guard] Status=$status | File=$filePath | Duration=${durationMs}ms")

    # 2. Ghi dau chan ben vung vao file JSONL
    try {
        $logDir = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot "..\..\logs"))
        if (-not (Test-Path $logDir)) {
            New-Item -ItemType Directory -Path $logDir -Force | Out-Null
        }
        $logFile = Join-Path $logDir "guard-footprints.jsonl"
        $footprint = [ordered]@{
            timestamp  = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss.fff")
            guard      = "diff-scope-guard"
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
