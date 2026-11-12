# .agents/scripts/guards/semantic-anchor-guard.ps1
# Deterministic Semantic Anchor Guard (C-QUAL-02)
# Enforces Machine-Readable Anchors (YAML/JSON/XML) for Non-Existent Entities and Boundary Violations

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
$refusalPattern = '(?i)(không tồn tại|khong ton tai|không tìm thấy|khong tim thay|không có thật|khong co that|not found|NOT_FOUND|chưa được cài đặt|chua duoc cai dat)'
$isRefusalOrNotFound = ($InputText -match $refusalPattern)

if ($isRefusalOrNotFound) {
    # Bat buoc phai co machine-readable anchor: yaml, json, hoac xml block voi truong status hoac error_classification
    $hasStructuredAnchor = ($InputText -match '(?s)```(yaml|json|xml).*?(status\s*:|error_classification\s*:|<status>).*?```')
    
    if (-not $hasStructuredAnchor) {
        $issues += "Phat hien tu choi/khong ton tai nhung thieu Semantic Anchor (bat buoc co khoi YAML/JSON/XML chua status va error_classification theo C-QUAL-02)"
    }
}

$status = if ($issues.Count -eq 0) { "PASS" } else { "FLAGGED" }

$result = [ordered]@{
    guard = "semantic-anchor-guard"
    status = $status
    isRefusal = $isRefusalOrNotFound
    issuesCount = $issues.Count
    issues = $issues
}

$result | ConvertTo-Json -Compress
if ($status -eq "PASS") {
    exit 0
} else {
    exit 1
}
