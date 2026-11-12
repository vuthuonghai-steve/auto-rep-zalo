# .agents/scripts/guards/xml-attribute-safety-guard.ps1
# Deterministic XML Shell-Safety & Sub-Element Architecture Guard
# Prevents Shell CLI Argument Collision by Enforcing Sub-Element Nodes over Unescaped Attributes

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
$safeNodesCount = 0

# Tim cac the XML co chua attributes voi dau nhay kep de gay xung dot tren CLI
$riskyAttributeMatches = [regex]::Matches($InputText, '<[a-zA-Z0-9_\-]+\s+[^>]*?="[^"]*"[^>]*?>')
foreach ($m in $riskyAttributeMatches) {
    $tag = $m.Value
    # Bo qua cac the HTML co ban neu co
    if ($tag -match '^<(a|img|link|span|div)\s') { continue }
    $issues += "Phat hien the XML co attributes chua dau nhay kep de gay xung dot tren CLI: $tag (khuyen nghi dung the con <status>...</status> thay vi attribute)"
}

# Kiem tra xem co cau truc Sub-Element an toan khong
$safeElementMatches = [regex]::Matches($InputText, '(?s)<([a-zA-Z0-9_\-]+)>[\s\r\n]*<([a-zA-Z0-9_\-]+)>([\s\S]*?)<\/\2>[\s\r\n]*<\/\1>')
$safeNodesCount = $safeElementMatches.Count

$status = if ($issues.Count -eq 0) { "PASS" } else { "FLAGGED" }

$result = [ordered]@{
    guard = "xml-attribute-safety-guard"
    status = $status
    safeNodesCount = $safeNodesCount
    issuesCount = $issues.Count
    issues = $issues
}

$result | ConvertTo-Json -Compress
if ($status -eq "PASS") {
    exit 0
} else {
    exit 1
}
