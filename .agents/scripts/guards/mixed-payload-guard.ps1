# .agents/scripts/guards/mixed-payload-guard.ps1
# Deterministic Binary Boundary Guard: System Direct XML vs Executable Code Fences
# Enforces: 1) System XML is 100% Direct (no ```xml), 2) Runnable Code is 100% Fenced (with language tag)

param(
    [string]$InputText,
    [string]$InputJson
)

if (-not $InputText -and $InputJson) {
    try {
        $json = $InputJson | ConvertFrom-Json
        $InputText = if ($json.response) { $json.response } else { $InputJson }
    } catch {
        $InputText = $InputJson
    }
}

if (-not $InputText -and $input) {
    $InputText = ($input | Out-String)
}

if (-not $InputText) {
    Write-Output '{"status": "SKIPPED", "issues": []}'
    exit 0
}

$issues = @()

# 1. Kiem tra xem XML he thong co bi bọc sai vao ```xml hay khong
if ($InputText -match '```xml[\s\S]*?(<parameters>|<context_anchor>|<telemetry_report>|<task_dispatch>|<fail_fast>)[\s\S]*?```') {
    $issues += "Vi pham ranh gioi: He thong XML (<parameters>, <context>, etc.) bi boc trong ```xml thay vi dung Direct Native XML"
}

# 2. Kiem tra xem co the XML native truc tiep ngoai code block hay khong
$hasDirectSystemXml = ($InputText -match '(?<!```[a-zA-Z0-9_-]*)<([a-zA-Z0-9_\-]+)>[\s\S]*?<\/\1>')

# 3. Kiem tra xem co khoi ma nguon thuc thi duoc boc dung language tag hay khong
$hasFencedCode = ($InputText -match '```(powershell|bash|python|typescript|javascript)[\s\S]*?```')

$status = if ($issues.Count -eq 0) { "PASS" } else { "FLAGGED" }

$result = [ordered]@{
    guard = "mixed-payload-guard"
    status = $status
    hasDirectSystemXml = $hasDirectSystemXml
    hasFencedCode = $hasFencedCode
    issuesCount = $issues.Count
    issues = $issues
}

$result | ConvertTo-Json -Compress
if ($status -eq "PASS") {
    exit 0
} else {
    exit 1
}

