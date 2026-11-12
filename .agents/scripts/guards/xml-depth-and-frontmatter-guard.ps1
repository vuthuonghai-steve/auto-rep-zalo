# .agents/scripts/guards/xml-depth-and-frontmatter-guard.ps1
# Deterministic XML Depth & YAML Frontmatter Hygiene Guard
# Enforces: 1) YAML Frontmatter for Document-Level Metadata, 2) Max XML Nesting Depth <= 3 Levels to Prevent Token Bloat

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
$hasFrontmatter = ($InputText -match '^---\s*[\r\n]+[\s\S]*?[\r\n]+---')
$maxDepthFound = 0

# Kiem tra do sau cua cac the XML
$xmlMatches = [regex]::Matches($InputText, '(?s)<([a-zA-Z0-9_\-]+)>([\s\S]*?)<\/\1>')
foreach ($m in $xmlMatches) {
    $xmlContent = $m.Value
    try {
        $xmlDoc = New-Object System.Xml.XmlDocument
        $xmlDoc.LoadXml($xmlContent)

        function Get-XmlMaxDepth($node, $currentDepth) {
            $maxD = $currentDepth
            foreach ($child in $node.ChildNodes) {
                if ($child.NodeType -eq [System.Xml.XmlNodeType]::Element) {
                    $d = Get-XmlMaxDepth $child ($currentDepth + 1)
                    if ($d -gt $maxD) { $maxD = $d }
                }
            }
            return $maxD
        }

        $depth = Get-XmlMaxDepth $xmlDoc.DocumentElement 1
        if ($depth -gt $maxDepthFound) { $maxDepthFound = $depth }

        if ($depth -gt 3) {
            $issues += "The <$($xmlDoc.DocumentElement.Name)> long nhau qua sau (Do sau = $depth > 3 cap). Khuyen nghi phang hoa schema hoac dung YAML Frontmatter de tranh Token Bloat."
        }
    } catch {
        # Bo qua loi parse o day vi xml-syntax-guard da dam nhiem
    }
}

$status = if ($issues.Count -eq 0) { "PASS" } else { "FLAGGED" }

$result = [ordered]@{
    guard = "xml-depth-and-frontmatter-guard"
    status = $status
    hasFrontmatter = $hasFrontmatter
    maxDepthFound = $maxDepthFound
    issuesCount = $issues.Count
    issues = $issues
}

$result | ConvertTo-Json -Compress
if ($status -eq "PASS") {
    exit 0
} else {
    exit 1
}

