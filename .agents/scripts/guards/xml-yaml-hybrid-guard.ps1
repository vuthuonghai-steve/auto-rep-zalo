# .agents/scripts/guards/xml-yaml-hybrid-guard.ps1
# Deterministic Hybrid XML-Wrapped YAML Architecture Guard
# Enforces: 1) XML Boundary Tags as Enclosures, 2) Strict YAML Key-Value Structure Inside (No Nested XML Tags)

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
$validHybridBlocksCount = 0

# Trich xuat cac khoi XML he thong
$xmlMatches = [regex]::Matches($InputText, '(?s)<([a-zA-Z0-9_\-]+)>([\s\S]*?)<\/\1>')

foreach ($m in $xmlMatches) {
    $tagName = $m.Groups[1].Value
    $innerContent = $m.Groups[2].Value.Trim()

    # Bo qua cac the HTML co ban
    if ($tagName -match '^(b|i|u|strong|em|p|br|code|pre|a)$') { continue }

    # Neu khoi XML la khoi he thong (context_anchor, fail_fast, task_dispatch, system_checkpoint, parameters, telemetry)
    if ($tagName -match '^(context_anchor|fail_fast|task_dispatch|system_checkpoint|parameters|telemetry|checkpoint)$') {
        # 1. Kiem tra xem co the XML con long ben trong khong (Vi pham nguyen tac parsimonious)
        if ($innerContent -match '<[a-zA-Z0-9_\-]+>') {
            $issues += "The <$tagName> vi pham kien truc lai: Van chua the XML con long nhau thay vi dung YAML key-value nghiem ngat"
        }

        # 2. Kiem tra xem noi dung ben trong co phai la YAML hop le voi key-value khong
        $hasYamlKeyValue = ($innerContent -match '(?m)^[a-zA-Z0-9_\-]+:\s*.+$')
        if (-not $hasYamlKeyValue) {
            $issues += "The <$tagName> thieu cau truc YAML key-value nghiem ngat ben trong"
        } else {
            $validHybridBlocksCount++
        }
    }
}

$status = if ($issues.Count -eq 0) { "PASS" } else { "FLAGGED" }

$result = [ordered]@{
    guard = "xml-yaml-hybrid-guard"
    status = $status
    validHybridBlocksCount = $validHybridBlocksCount
    issuesCount = $issues.Count
    issues = $issues
}

$result | ConvertTo-Json -Compress
if ($status -eq "PASS") {
    exit 0
} else {
    exit 1
}

