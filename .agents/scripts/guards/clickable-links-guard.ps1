# .agents/scripts/guards/clickable-links-guard.ps1
# Deterministic Clickable File Links & Dead Link Guard (C-QUAL-03 & C-READ-04)
# Enforces Clickable Markdown Links [name](file:///path) and Verifies Physical Existence on Disk

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
$validLinksCount = 0

# 1. Tim cac link markdown hop le dang [name](file:///path)
$linkMatches = [regex]::Matches($InputText, '\[([^\]]+)\]\(file:\/\/\/([^\)#]+)(?:#L\d+(?:-L\d+)?)?\)')
foreach ($m in $linkMatches) {
    $linkText = $m.Groups[1].Value
    $filePath = [System.Uri]::UnescapeDataString($m.Groups[2].Value)

    # Convert ve duong dan Windows chuan de test
    $localPath = $filePath -replace '^/([a-zA-Z]):', '$1:' -replace '/', '\'
    if (Test-Path $localPath) {
        $validLinksCount++
    } else {
        $issues += "Dead Link: File duoc dan link khong ton tai tren o dia: $localPath"
    }
}

# 2. Tim cac duong dan file tran khong duoc boc trong markdown link (Raw paths)
# Vi du: C:\Users\... khong nam trong ngoac (file:///...)
$lines = $InputText -split "`r?`n"
for ($i = 0; $i -lt $lines.Count; $i++) {
    $line = $lines[$i]
    $lineNum = $i + 1

    # Bo qua cac dong code block
    if ($line -match '^\s*```') { continue }

    # Tim duong dan tuyet doi Windows dang text tran: C:\... khong di sau (file:///
    if ($line -match '(?<!\(file:\/\/\/)[a-zA-Z]:\\(?:[a-zA-Z0-9_\-\.\\]+)' -and $line -notmatch '\[.+?\]\(file:\/\/\/') {
        # Kiem tra xem co phai duong dan hop le khong
        $rawPath = $matches[0]
        if ($rawPath.Length -gt 8 -and (Test-Path $rawPath)) {
            $issues += "Line ${lineNum} - Phat hien duong dan text tran (Raw Path) khong phai link clickable: $rawPath (bat buoc format [basename](file:///path))"
        }
    }
}

$status = if ($issues.Count -eq 0) { "PASS" } else { "FLAGGED" }

$result = [ordered]@{
    guard = "clickable-links-guard"
    status = $status
    validLinksCount = $validLinksCount
    issuesCount = $issues.Count
    issues = $issues
}

$result | ConvertTo-Json -Compress
if ($status -eq "PASS") {
    exit 0
} else {
    exit 1
}
