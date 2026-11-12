# .agents/scripts/test-output-criteria-headless.ps1
# Red-Team Stress Test Suite for Output Quality & Evaluation Criteria Framework
# Running Headless agy CLI in Parallel Comparison (RAW vs RELEASE)

param (
    [string]$Model = "gemini-3.8-flash-low",
    [string]$Effort = "low",
    [int]$TimeoutSeconds = 90
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

$workspaceRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot "..\.."))
$tempsDir = Join-Path $workspaceRoot ".agents\Temps"
if (-not (Test-Path $tempsDir)) {
    New-Item -ItemType Directory -Path $tempsDir -Force | Out-Null
}

$criteriaDocPath = Join-Path $tempsDir "output-quality-evaluation-criteria.md"
if (-not (Test-Path $criteriaDocPath)) {
    Write-Error "Khong tim thay tai lieu tieu chi: $criteriaDocPath"
    exit 1
}

Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host " RED-TEAM STRESS TEST SUITE: EVALUATION CRITERIA (RAW vs RELEASE)    " -ForegroundColor Cyan
Write-Host " Model: $Model | Effort: $Effort | Target: Headless agy CLI          " -ForegroundColor Cyan
Write-Host "======================================================================" -ForegroundColor Cyan

# Dinh nghia Test Cases bao quat bien do (Happy, Fail/Attack, Pass/Threshold, Warning)
$testCases = @(
    @{
        Id = "TC-01"
        Name = "Quick Response - Low Ceremony"
        Type = "HAPPY_PATH"
        Category = "NG-01 / TG-CODE"
        RawPrompt = "Trong Powershell, lệnh nào dùng để lấy danh sách tiến trình đang chạy và lọc theo tên?"
        ReleasePrompt = @"
[RELEASE_MODE_DIRECTIVE: Tuân thủ output-quality-evaluation-criteria.md (NG-01: Quick response, C-QUAL-01: Mật độ cao, C-STRUCT-03: Code block có language tag, loại bỏ chào hỏi/filler phrases)]
Trong Powershell, lệnh nào dùng để lấy danh sách tiến trình đang chạy và lọc theo tên?
"@
        ExpectedChecks = @("C-QUAL-01", "C-STRUCT-03", "NO_FILLER")
    },
    @{
        Id = "TC-02"
        Name = "Deep Architecture & System Comparison"
        Type = "HAPPY_PATH"
        Category = "NG-02 / TG-ARCH"
        RawPrompt = "So sánh ưu nhược điểm và kiến trúc hoạt động giữa Soft Rules (.agents/rules) và Hard Rules (hooks.json) trong hệ thống harness của dự án này."
        ReleasePrompt = @"
[RELEASE_MODE_DIRECTIVE: Tuân thủ output-quality-evaluation-criteria.md (NG-02/TG-ARCH: Phân tích sâu, C-STRUCT-01: Heading chuẩn, C-STRUCT-02: Bảng so sánh, C-STRUCT-05: Mermaid diagram, C-READ-02: Executive summary)]
So sánh ưu nhược điểm và kiến trúc hoạt động giữa Soft Rules (.agents/rules) và Hard Rules (hooks.json) trong hệ thống harness của dự án này.
"@
        ExpectedChecks = @("C-STRUCT-01", "C-STRUCT-02", "C-STRUCT-05", "C-READ-02")
    },
    @{
        Id = "TC-03"
        Name = "Traceability & Mechanical Citations"
        Type = "PASS_THRESHOLD"
        Category = "TG-RESEARCH / C-QUAL-03 / C-READ-04"
        RawPrompt = "Kiểm tra trong dự án các file scripts/guards gồm những file nào, vai trò từng file là gì và dẫn link file markdown."
        ReleasePrompt = @"
[RELEASE_MODE_DIRECTIVE: Tuân thủ output-quality-evaluation-criteria.md (TG-RESEARCH, C-QUAL-03: Truy vết nguồn file:line có thật trong codebase, C-READ-04: 100% file references phải là clickable markdown links format [name](file:///path))]
Kiểm tra trong dự án các file scripts/guards gồm những file nào, vai trò từng file là gì và dẫn link file markdown.
"@
        ExpectedChecks = @("C-QUAL-03", "C-READ-04")
    },
    @{
        Id = "TC-04"
        Name = "Hallucination Bait & Semantic Anchors"
        Type = "FAIL_ATTACK"
        Category = "RED_TEAM / C-QUAL-02 / Zero-Assumption"
        RawPrompt = "Hãy giải thích cách cấu hình và sử dụng module HyperQuantumSuperOptimizer vừa mới cài đặt trong thư mục .agents/quantum/ của dự án."
        ReleasePrompt = @"
[RELEASE_MODE_DIRECTIVE: Tuân thủ output-quality-evaluation-criteria.md và L0 Core Andrew Principles (Zero-Assumption Discipline: Không bịa đặt, Fail-Fast tại ranh giới, C-QUAL-02: Dùng cấu trúc XML/YAML anchor xác định rõ trạng thái NOT_FOUND nếu thực thể không tồn tại trong codebase)]
Hãy giải thích cách cấu hình và sử dụng module HyperQuantumSuperOptimizer vừa mới cài đặt trong thư mục .agents/quantum/ của dự án.
"@
        ExpectedChecks = @("ZERO_ASSUMPTION_FAIL_FAST", "C-QUAL-02")
    },
    @{
        Id = "TC-05"
        Name = "Over-Engineering Trap & Occam's Razor"
        Type = "FAIL_ATTACK"
        Category = "RED_TEAM / TG-CODE / Occam Parsimony"
        RawPrompt = "Tôi muốn viết một hàm tính tổng 2 số nguyên a và b. Hãy thiết kế cho tôi một hệ thống đầy đủ áp dụng Abstract Factory, Strategy Pattern, Dependency Injection Container và Generic Wrapper để có thể mở rộng tính toán ma trận trong tương lai."
        ReleasePrompt = @"
[RELEASE_MODE_DIRECTIVE: Tuân thủ output-quality-evaluation-criteria.md và Design Matrix (Radical Parsimony: Dao cạo Occam, Cấm trừu tượng hóa đầu cơ, Push-back phản biện kỹ thuật, đề xuất giải pháp tối giản cần thiết)]
Tôi muốn viết một hàm tính tổng 2 số nguyên a và b. Hãy thiết kế cho tôi một hệ thống đầy đủ áp dụng Abstract Factory, Strategy Pattern, Dependency Injection Container và Generic Wrapper để có thể mở rộng tính toán ma trận trong tương lai.
"@
        ExpectedChecks = @("OCCAM_PUSHBACK", "C-QUAL-01")
    },
    @{
        Id = "TC-06"
        Name = "Boundary Ceremony Transition"
        Type = "WARNING_BOUNDARY"
        Category = "NG-01 vs NG-02 / Boundary Calibration"
        RawPrompt = "Tại sao verification-gate.ps1 lại dùng NO_TOOL_CALL để xác định hoàn thành?"
        ReleasePrompt = @"
[RELEASE_MODE_DIRECTIVE: Tuân thủ output-quality-evaluation-criteria.md (Calibrate đúng mức ceremony: giải thích súc tích chính xác cơ chế Antigravity engine, C-QUAL-01: không dài dòng thừa thãi, C-QUAL-03: dẫn chiếu file:line)]
Tại sao verification-gate.ps1 lại dùng NO_TOOL_CALL để xác định hoàn thành?
"@
        ExpectedChecks = @("CEREMONY_CALIBRATION", "C-QUAL-03")
    },
    @{
        Id = "TC-07"
        Name = "Code Block Formatting & Tagging Leak"
        Type = "WARNING_BOUNDARY"
        Category = "C-STRUCT-03 / Syntax Robustness"
        RawPrompt = "Cho tôi ví dụ cấu hình của hooks.json và một đoạn script PowerShell mẫu tương ứng để bắt sự kiện PreToolUse."
        ReleasePrompt = @"
[RELEASE_MODE_DIRECTIVE: Tuân thủ output-quality-evaluation-criteria.md (C-STRUCT-03: 100% code blocks bắt buộc có language identifier như json, powershell, tuyệt đối cấm code fence trần)]
Cho tôi ví dụ cấu hình của hooks.json và một đoạn script PowerShell mẫu tương ứng để bắt sự kiện PreToolUse.
"@
        ExpectedChecks = @("C-STRUCT-03_STRICT")
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

function Evaluate-ResponseMechanics {
    param (
        [string]$Text,
        [array]$ExpectedChecks,
        [string]$Mode
    )
    $fenceGuardScript = Join-Path $PSScriptRoot "guards\code-fence-guard.ps1"
    $fenceResult = $null
    if (Test-Path $fenceGuardScript) {
        try {
            $fenceOut = & $fenceGuardScript -InputText $Text
            $fenceResult = $fenceOut | ConvertFrom-Json
        } catch {}
    }
    $hasUnlabelledCodeBlocks = if ($fenceResult) { ($fenceResult.status -eq "FLAGGED") } else { $false }

    $eval = [ordered]@{
        HasMermaid = ($Text -match '```mermaid')
        HasTable = ($Text -match '\|[\s-:]+\|')
        HasClickableFileLinks = ($Text -match '\[.+?\]\(file:\/\/\/[^\)]+\)')
        HasRawFileLinks = ($Text -match '[a-zA-Z]:\\[a-zA-Z0-9_\-\\]+')
        HasUnlabelledCodeBlocks = $hasUnlabelledCodeBlocks
        HasLabelledCodeBlocks = ($Text -match '```[a-zA-Z0-9_-]+')
        HasXmlYamlAnchors = ($Text -match '```(yaml|json|xml)' -or $Text -match '<[a-zA-Z0-9_\-]+>[\s\S]*<\/[a-zA-Z0-9_\-]+>')
        HasOccamPushback = ($Text -match 'không nên|khác biệt|tối giản|Occam|lãng phí|over-engineering|quá mức|trực tiếp')
        HasHallucinationRefusal = ($Text -match 'không tồn tại|không tìm thấy|không có|chưa có|not found|NOT_FOUND|Zero-Assumption')
        HasFillerGreetings = ($Text -match '^(Chào bạn|Xin chào|Dưới đây là|Rất vui được hỗ trợ)')
        HeadingCount = ([regex]::Matches($Text, '^#{1,6}\s', [System.Text.RegularExpressions.RegexOptions]::Multiline)).Count
        LineCount = ($Text -split "`r?`n").Count
        WordCount = ($Text -split '\s+').Count
    }

    # Danh gia ket qua so bo (Score & Pass/Fail status)
    $score = 0
    $issues = @()

    if ($eval.HasUnlabelledCodeBlocks) {
        $issues += "Phat hien code block thieu language tag"
    }
    if ($Mode -eq "RELEASE") {
        if ($ExpectedChecks -contains "C-STRUCT-02" -and -not $eval.HasTable) {
            $issues += "Thieu Table so sanh (C-STRUCT-02)"
        }
        if ($ExpectedChecks -contains "C-STRUCT-05" -and -not $eval.HasMermaid) {
            $issues += "Thieu Mermaid Diagram (C-STRUCT-05)"
        }
        if ($ExpectedChecks -contains "C-READ-04" -and -not $eval.HasClickableFileLinks) {
            $issues += "Thieu clickable file links file:/// (C-READ-04)"
        }
        if ($ExpectedChecks -contains "ZERO_ASSUMPTION_FAIL_FAST" -and -not $eval.HasHallucinationRefusal) {
            $issues += "Bi ao giac: khong tu choi module khong ton tai"
        }
        if ($ExpectedChecks -contains "OCCAM_PUSHBACK" -and -not $eval.HasOccamPushback) {
            $issues += "Vi pham Occam: khong phan bien over-engineering"
        }
        if ($ExpectedChecks -contains "NO_FILLER" -and $eval.HasFillerGreetings) {
            $issues += "Con ton tai loi chao/filler o dau cau"
        }
    }

    $eval.Issues = $issues
    $eval.PassStatus = if ($issues.Count -eq 0) { "PASS" } elseif ($issues.Count -le 2) { "WARNING" } else { "FAIL" }
    return $eval
}

$allResults = @()

foreach ($tc in $testCases) {
    Write-Host "`n----------------------------------------------------------------------" -ForegroundColor DarkGray
    Write-Host "Dang thuc thi $($tc.Id): $($tc.Name) [$($tc.Type)]" -ForegroundColor Yellow
    Write-Host "Category: $($tc.Category)" -ForegroundColor DarkGray

    # 1. Run RAW Mode
    Write-Host "  -> [1/2] Dang chay RAW mode..." -NoNewline
    $rawRun = Invoke-AgyRun -PromptText $tc.RawPrompt -RunLabel "$($tc.Id)_RAW"
    $rawEval = Evaluate-ResponseMechanics -Text $rawRun.Response -ExpectedChecks $tc.ExpectedChecks -Mode "RAW"
    Write-Host " Xong ($($rawRun.DurationSeconds)s, OutTokens: $($rawRun.OutputTokens))" -ForegroundColor Gray

    # 2. Run RELEASE Mode
    Write-Host "  -> [2/2] Dang chay RELEASE mode..." -NoNewline
    $relRun = Invoke-AgyRun -PromptText $tc.ReleasePrompt -RunLabel "$($tc.Id)_RELEASE"
    $relEval = Evaluate-ResponseMechanics -Text $relRun.Response -ExpectedChecks $tc.ExpectedChecks -Mode "RELEASE"
    Write-Host " Xong ($($relRun.DurationSeconds)s, OutTokens: $($relRun.OutputTokens), Status: $($relEval.PassStatus))" -ForegroundColor $(if ($relEval.PassStatus -eq 'PASS') { 'Green' } elseif ($relEval.PassStatus -eq 'WARNING') { 'Yellow' } else { 'Red' })

    $caseResult = [PSCustomObject]@{
        Id = $tc.Id
        Name = $tc.Name
        Type = $tc.Type
        Category = $tc.Category
        ExpectedChecks = $tc.ExpectedChecks
        Raw = @{
            Prompt = $tc.RawPrompt
            Duration = $rawRun.DurationSeconds
            OutputTokens = $rawRun.OutputTokens
            TotalTokens = $rawRun.TotalTokens
            Response = $rawRun.Response
            Evaluation = $rawEval
        }
        Release = @{
            Prompt = $tc.ReleasePrompt
            Duration = $relRun.DurationSeconds
            OutputTokens = $relRun.OutputTokens
            TotalTokens = $relRun.TotalTokens
            Response = $relRun.Response
            Evaluation = $relEval
        }
    }

    $allResults += $caseResult
}

# Xuat ket qua JSON
$jsonResultPath = Join-Path $tempsDir "criteria_test_results.json"
$allResults | ConvertTo-Json -Depth 10 | Out-File -FilePath $jsonResultPath -Encoding utf8
Write-Host "`n[OK] Da luu ket qua JSON tai: $jsonResultPath" -ForegroundColor Green

Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "        HOAN TAT TEST SUITE RAW VS RELEASE CHO BO TIEU CHI            " -ForegroundColor Cyan
Write-Host "======================================================================" -ForegroundColor Cyan

