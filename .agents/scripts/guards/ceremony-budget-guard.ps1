# .agents/scripts/guards/ceremony-budget-guard.ps1
# Deterministic Ceremony Budget Guard (C-QUAL-01 & Adaptive Ceremony)
# Prevents Token Inflation & Over-Ceremony on Low-Ceremony Tasks (NG-01)

param(
    [string]$InputText,
    [string]$InputJson,
    [string]$CeremonyLevel = "AUTO"
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
$hasMermaid = ($InputText -match '```mermaid')
$hasExecutiveSummary = ($InputText -match '(?i)(executive summary|tóm tắt điều hành)')
$lineCount = ($InputText -split "`r?`n").Count
$wordCount = ($InputText -split '\s+').Count

# Neu CeremonyLevel la LOW hoac van ban rat ngan (< 30 dong)
# Ranh gioi cam: Khong duoc chua Mermaid hoac Executive Summary vi gay Token Inflation
if ($CeremonyLevel -eq "LOW" -or ($lineCount -lt 30 -and $wordCount -lt 250)) {
    if ($hasMermaid) {
        $issues += "Vi pham Over-Ceremony: Tac vu Low Ceremony (NG-01) khong duoc chua so do Mermaid gay lang phi token"
    }
    if ($hasExecutiveSummary) {
        $issues += "Vi pham Over-Ceremony: Tac vu Low Ceremony khong can Executive Summary"
    }
}

$status = if ($issues.Count -eq 0) { "PASS" } else { "FLAGGED" }

$result = [ordered]@{
    guard = "ceremony-budget-guard"
    status = $status
    lineCount = $lineCount
    wordCount = $wordCount
    hasMermaid = $hasMermaid
    hasExecutiveSummary = $hasExecutiveSummary
    issuesCount = $issues.Count
    issues = $issues
}

$result | ConvertTo-Json -Compress
if ($status -eq "PASS") {
    exit 0
} else {
    exit 1
}
