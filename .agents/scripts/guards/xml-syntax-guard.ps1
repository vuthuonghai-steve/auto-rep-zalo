# .agents/scripts/guards/xml-syntax-guard.ps1
# Deterministic XML Syntax & CDATA Validation Guard
# Enforces Valid Native XML Tags, Catches Unescaped Characters (<, >, &) and Verifies CDATA Sections

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
$validXmlCount = 0

# Trich xuat cac khoi XML native truc tiep: <tag>...</tag>
$xmlMatches = [regex]::Matches($InputText, '(?s)<([a-zA-Z0-9_\-]+)(\s+[^>]*)?>([\s\S]*?)<\/\1>')

if ($xmlMatches.Count -gt 0) {
    foreach ($m in $xmlMatches) {
        $fullXml = $m.Value
        $tagName = $m.Groups[1].Value

        # Bo qua cac the HTML co ban neu co (nhu <b>, <i>, <br>)
        if ($tagName -match '^(b|i|u|strong|em|p|br|code|pre|a)$') { continue }

        try {
            # Thu parse bang .NET XML Parser
            $xmlDoc = New-Object System.Xml.XmlDocument
            $xmlDoc.LoadXml($fullXml)
            $validXmlCount++
        } catch {
            $issues += "The <$tagName> chua XML khong hop le hoac chua duoc escape/CDATA: " + $_.Exception.Message
        }
    }
}

$status = if ($issues.Count -eq 0) { "PASS" } else { "FLAGGED" }

$result = [ordered]@{
    guard = "xml-syntax-guard"
    status = $status
    validXmlCount = $validXmlCount
    issuesCount = $issues.Count
    issues = $issues
}

$result | ConvertTo-Json -Compress
if ($status -eq "PASS") {
    exit 0
} else {
    exit 1
}

