# .agents/scripts/guards/code-fence-guard.ps1
# Deterministic State Machine Parser for Markdown Code Block Validation (C-STRUCT-03)
# Resolves 100% False-Positive on Closing Fences by Tracking State Transitions

param(
    [string]$InputText,
    [string]$InputJson
)

# 1. Thu thap Text tu InputText hoac JSON payload
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

# 2. State Machine Parser
$lines = $InputText -split "`r?`n"
$insideBlock = $false
$currentLang = ""
$openLineNumber = 0
$issues = @()
$validBlocksCount = 0

for ($i = 0; $i -lt $lines.Count; $i++) {
    $line = $lines[$i]
    $lineNum = $i + 1

    # Match block fence: 3 hoac nhieu hon ky tu backtick
    if ($line -match '^(\s*)(`{3,})(.*)$') {
        $indent = $matches[1]
        $fence = $matches[2]
        $info = $matches[3].Trim()

        if (-not $insideBlock) {
            # Day la OPENING FENCE
            $insideBlock = $true
            $openLineNumber = $lineNum
            
            if ([string]::IsNullOrWhiteSpace($info)) {
                # Vi pham C-STRUCT-03: Opening fence khong co language tag
                $issues += "Line ${lineNum} - Opening code fence thieu language tag (bat buoc co identifier nhu powershell, json, yaml, etc.)"
            } else {
                # Trich xuat tag dau tien (vi du: ```json {some info} -> json)
                $tag = ($info -split '\s+')[0]
                $currentLang = $tag
                $validBlocksCount++
            }
        } else {
            # Day la CLOSING FENCE: Chuyen state tro lai outside, khong yeu cau language tag
            $insideBlock = $false
            $currentLang = ""
        }
    }
}

# Kiem tra neu ket thuc van ban ma code block chua duoc dong
if ($insideBlock) {
    $issues += "Line ${openLineNumber} - Code block mo nhung chua duoc dong bang closing fence"
}

$status = if ($issues.Count -eq 0) { "PASS" } else { "FLAGGED" }

$result = [ordered]@{
    guard = "code-fence-guard"
    status = $status
    validBlocksCount = $validBlocksCount
    issuesCount = $issues.Count
    issues = $issues
}

$result | ConvertTo-Json -Compress
if ($status -eq "PASS") {
    exit 0
} else {
    exit 1
}
