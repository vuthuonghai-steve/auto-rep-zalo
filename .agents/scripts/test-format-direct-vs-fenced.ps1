# .agents/scripts/test-format-direct-vs-fenced.ps1
# Comparative Benchmark & Stress Test: Fenced Code Blocks (```yaml, ```xml) vs Direct Native Markup (XML tags, YAML)
# Running Headless agy CLI in Parallel Comparison

param (
    [string]$Model = "gemini-3.8-flash-low",
    [string]$Effort = "low"
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

$scriptDir = $PSScriptRoot
$worktreeRoot = [System.IO.Path]::GetFullPath((Join-Path $scriptDir "..\.."))
$tempsDir = Join-Path $worktreeRoot ".agents\Temps"
if (-not (Test-Path $tempsDir)) {
    New-Item -ItemType Directory -Path $tempsDir -Force | Out-Null
}

Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "  BENCHMARK: FENCED CODE BLOCKS VS DIRECT NATIVE MARKUP IN MARKDOWN   " -ForegroundColor Cyan
Write-Host "  Model: $Model | Effort: $Effort | Target: Headless agy CLI          " -ForegroundColor Cyan
Write-Host "======================================================================" -ForegroundColor Cyan

# Dinh nghia 4 kich ban kiem thu doi sanh
$scenarios = @(
    @{
        Id = "SCN-01"
        Name = "System Context Anchoring & Metadata"
        Topic = "Đóng neo ngữ cảnh hệ thống và metadata tác tử"
        # Prompt Fenced
        FencedPrompt = @"
Hãy xuất thông tin bối cảnh hệ thống cho phiên làm việc hiện tại (workspace path, target agent, active rules, timestamp). 
BẮT BUỘC đóng gói toàn bộ metadata trong một FENCED CODE BLOCK định dạng YAML (sử dụng ```yaml).
"@
        # Prompt Direct
        DirectPrompt = @"
Hãy xuất thông tin bối cảnh hệ thống cho phiên làm việc hiện tại (workspace path, target agent, active rules, timestamp). 
BẮT BUỘC nhúng trực tiếp bằng NATIVE XML TAGS thuần (ví dụ <context_anchor>...</context_anchor>) TRỰC TIẾP trong Markdown, TUYỆT ĐỐI KHÔNG bọc trong khối code block ```.
"@
    },
    @{
        Id = "SCN-02"
        Name = "Boundary Fail-Fast Semantic Anchoring"
        Topic = "Đóng neo từ chối thực thể không tồn tại (Zero-Assumption)"
        # Prompt Fenced
        FencedPrompt = @"
Hãy giải thích cách sử dụng module HyperQuantumSuperOptimizer trong thư mục .agents/quantum/. 
Nếu không tồn tại, thực hiện Fail-Fast và BẮT BUỘC đóng neo trạng thái NOT_FOUND bằng một FENCED CODE BLOCK định dạng YAML (sử dụng ```yaml).
"@
        # Prompt Direct
        DirectPrompt = @"
Hãy giải thích cách sử dụng module HyperQuantumSuperOptimizer trong thư mục .agents/quantum/. 
Nếu không tồn tại, thực hiện Fail-Fast và BẮT BUỘC đóng neo trạng thái NOT_FOUND bằng NATIVE XML TAGS (ví dụ <fail_fast status="NOT_FOUND">...</fail_fast>) TRỰC TIẾP trong văn bản, TUYỆT ĐỐI KHÔNG bọc trong code block ```.
"@
    },
    @{
        Id = "SCN-03"
        Name = "Structured Telemetry & Metric Key-Values"
        Topic = "Báo cáo số liệu viễn trắc đo lường (Telemetry)"
        # Prompt Fenced
        FencedPrompt = @"
Tạo một báo cáo viễn trắc kiểm thử gồm: test_id, duration_ms, memory_mb, gates_passed (Gate 1 đến Gate 5), final_verdict.
BẮT BUỘC đặt dữ liệu viễn trắc này trong FENCED CODE BLOCK định dạng XML (sử dụng ```xml).
"@
        # Prompt Direct
        DirectPrompt = @"
Tạo một báo cáo viễn trắc kiểm thử gồm: test_id, duration_ms, memory_mb, gates_passed (Gate 1 đến Gate 5), final_verdict.
BẮT BUỘC nhúng dữ liệu viễn trắc này bằng NATIVE XML TAGS thuần (ví dụ <telemetry_report>...</telemetry_report>) TRỰC TIẾP trong văn bản Markdown, TUYỆT ĐỐI KHÔNG bọc trong code block ```.
"@
    },
    @{
        Id = "SCN-04"
        Name = "Mixed Code & Data Payload"
        Topic = "Phối hợp giữa khối mã thực thi và cấu trúc dữ liệu"
        # Prompt Fenced
        FencedPrompt = @"
Cho tôi một đoạn mã PowerShell để quét tệp và kèm theo một khối cấu trúc mô tả tham số (parameters schema).
Khối mã PowerShell đặt trong ```powershell, khối tham số BẮT BUỘC đặt trong ```yaml.
"@
        # Prompt Direct
        DirectPrompt = @"
Cho tôi một đoạn mã PowerShell để quét tệp và kèm theo một cấu trúc mô tả tham số (parameters schema).
Khối mã PowerShell đặt trong ```powershell, còn cấu trúc tham số BẮT BUỘC viết bằng NATIVE XML TAGS (ví dụ <parameters>...</parameters>) TRỰC TIẾP ngoài Markdown, KHÔNG dùng code block cho tham số.
"@
    }
)

function Parse-AgyOutput {
    param ([string]$RawOutput)
    $lines = $RawOutput -split "`r?`n"
    $jsonLine = $lines | Where-Object { $_ -match '^\s*\{.*"status"\s*:\s*".*\}\s*$' } | Select-Object -Last 1
    if (-not $jsonLine) {
        $jsonLine = $lines | Where-Object { $_ -match '^\s*\{.*\}\s*$' } | Select-Object -Last 1
    }
    if ($jsonLine) {
        try {
            return ($jsonLine | ConvertFrom-Json)
        } catch {
            return $null
        }
    }
    return $null
}

function Invoke-AgyRun {
    param (
        [string]$PromptText,
        [string]$RunLabel
    )
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    $safePrompt = $PromptText -replace '"', '\"'
    $cmd = "agy -p `"$safePrompt`" --model $Model --effort $Effort --output-format json"
    
    $rawOut = ""
    try {
        Push-Location $worktreeRoot
        $rawOut = Invoke-Expression $cmd 2>&1 | Out-String
        $sw.Stop()
    } catch {
        $sw.Stop()
        return [PSCustomObject]@{
            Status = "ERROR"
            Response = $_.Exception.Message
            DurationSeconds = [Math]::Round($sw.Elapsed.TotalSeconds, 2)
            OutputTokens = 0
            TotalTokens = 0
            Raw = $rawOut
        }
    } finally {
        Pop-Location
    }

    $parsed = Parse-AgyOutput -RawOutput $rawOut
    if ($parsed -and $parsed.status -eq "SUCCESS") {
        return [PSCustomObject]@{
            Status = "SUCCESS"
            Response = $parsed.response
            DurationSeconds = [Math]::Round($parsed.duration_seconds, 2)
            OutputTokens = if ($parsed.usage) { $parsed.usage.output_tokens } else { 0 }
            TotalTokens = if ($parsed.usage) { $parsed.usage.total_tokens } else { 0 }
            Raw = $rawOut
        }
    } else {
        return [PSCustomObject]@{
            Status = if ($parsed) { $parsed.status } else { "UNKNOWN" }
            Response = if ($parsed) { $parsed.response } else { $rawOut }
            DurationSeconds = [Math]::Round($sw.Elapsed.TotalSeconds, 2)
            OutputTokens = 0
            TotalTokens = 0
            Raw = $rawOut
        }
    }
}

function Audit-FormatMechanics {
    param (
        [string]$Text,
        [string]$ExpectedMode # "FENCED" hoac "DIRECT"
    )

    $hasFencedYaml = ($Text -match '```yaml[\s\S]*?```')
    $hasFencedXml = ($Text -match '```xml[\s\S]*?```')
    $hasDirectXml = ($Text -match '(?<!```[a-z]*)<[a-zA-Z0-9_\-]+(\s+[^>]*)?>[\s\S]*?<\/[a-zA-Z0-9_\-]+>(?![\s\S]*?```)')
    $hasDirectYaml = ($Text -match '(?m)^[a-zA-Z0-9_\-]+:\s*.+$' -and -not ($Text -match '```yaml'))

    # Kiem tra tinh hop le XML (Machine Extraction)
    $xmlValid = $false
    $xmlExtracted = ""
    if ($Text -match '(<[a-zA-Z0-9_\-]+[\s\S]*?<\/[a-zA-Z0-9_\-]+>)') {
        $xmlCandidate = $matches[1]
        try {
            [xml]$parsedXml = $xmlCandidate
            $xmlValid = $true
            $xmlExtracted = "Parsed root: " + $parsedXml.DocumentElement.Name
        } catch {
            $xmlValid = $false
            $xmlExtracted = "XML parse error: " + $_.Exception.Message
        }
    }

    # Danh gia do tuan thu format yeu cau
    $compliancePass = $false
    $issues = @()

    if ($ExpectedMode -eq "FENCED") {
        if ($hasFencedYaml -or $hasFencedXml) {
            $compliancePass = $true
        } else {
            $issues += "Khong tim thay Fenced Code Block (```yaml hoac ```xml) theo yeu cau"
        }
    } elseif ($ExpectedMode -eq "DIRECT") {
        # Yeu cau dung truc tiep XML hoac YAML ngoai code block
        if ($hasDirectXml -or $hasDirectYaml) {
            $compliancePass = $true
        } else {
            $issues += "Khong tim thay Direct Markup (XML tags/YAML truc tiep ngoai code fence)"
        }
        # Kiem tra xem co bi lech sang dung ```xml hoac ```yaml khong
        if ($hasFencedXml -or $hasFencedYaml) {
            $issues += "Vi pham: Van dung code block (```) mac du yeu cau dung Direct Native Markup"
            $compliancePass = $false
        }
    }

    return [ordered]@{
        ExpectedMode = $ExpectedMode
        CompliancePass = $compliancePass
        HasFencedYaml = $hasFencedYaml
        HasFencedXml = $hasFencedXml
        HasDirectXml = $hasDirectXml
        HasDirectYaml = $hasDirectYaml
        XmlParseValid = $xmlValid
        XmlExtractionDetails = $xmlExtracted
        Issues = $issues
    }
}

$allResults = @()

foreach ($scn in $scenarios) {
    Write-Host "`n----------------------------------------------------------------------" -ForegroundColor DarkGray
    Write-Host "Kich Ban: $($scn.Id) - $($scn.Name)" -ForegroundColor Yellow
    Write-Host "Chu de: $($scn.Topic)" -ForegroundColor DarkGray

    # 1. Chay Fenced Mode
    Write-Host "  -> [1/2] Dang chay FENCED mode (```yaml / ```xml)..." -NoNewline
    $fencedRun = Invoke-AgyRun -PromptText $scn.FencedPrompt -RunLabel "$($scn.Id)_FENCED"
    $fencedAudit = Audit-FormatMechanics -Text $fencedRun.Response -ExpectedMode "FENCED"
    Write-Host " Xong ($($fencedRun.DurationSeconds)s, OutTokens: $($fencedRun.OutputTokens), Compliance: $($fencedAudit.CompliancePass))" -ForegroundColor $(if ($fencedAudit.CompliancePass) { 'Green' } else { 'Red' })

    # 2. Chay Direct Mode
    Write-Host "  -> [2/2] Dang chay DIRECT mode (Native XML tags / Direct YAML)..." -NoNewline
    $directRun = Invoke-AgyRun -PromptText $scn.DirectPrompt -RunLabel "$($scn.Id)_DIRECT"
    $directAudit = Audit-FormatMechanics -Text $directRun.Response -ExpectedMode "DIRECT"
    Write-Host " Xong ($($directRun.DurationSeconds)s, OutTokens: $($directRun.OutputTokens), Compliance: $($directAudit.CompliancePass))" -ForegroundColor $(if ($directAudit.CompliancePass) { 'Green' } else { 'Red' })

    $scnResult = [PSCustomObject]@{
        Id = $scn.Id
        Name = $scn.Name
        Topic = $scn.Topic
        Fenced = @{
            Prompt = $scn.FencedPrompt
            Duration = $fencedRun.DurationSeconds
            OutputTokens = $fencedRun.OutputTokens
            TotalTokens = $fencedRun.TotalTokens
            Response = $fencedRun.Response
            Audit = $fencedAudit
        }
        Direct = @{
            Prompt = $scn.DirectPrompt
            Duration = $directRun.DurationSeconds
            OutputTokens = $directRun.OutputTokens
            TotalTokens = $directRun.TotalTokens
            Response = $directRun.Response
            Audit = $directAudit
        }
    }

    $allResults += $scnResult
}

# Luu ket qua JSON
$jsonOut = Join-Path $tempsDir "format_comparison_results.json"
$allResults | ConvertTo-Json -Depth 10 | Out-File -FilePath $jsonOut -Encoding utf8
Write-Host "`n[OK] Da luu ket qua so sanh JSON tai: $jsonOut" -ForegroundColor Green
Write-Host "======================================================================" -ForegroundColor Cyan

