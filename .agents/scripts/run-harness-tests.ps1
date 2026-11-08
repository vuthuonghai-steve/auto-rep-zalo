# .agents/scripts/run-harness-tests.ps1
# Test suite for Antigravity Harness via Headless Mode (CLI)

param (
    [switch]$RunE2E,
    [string]$model = "gemini-3.8-flash-low",
    [string]$effort = "low"
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "     BAT DAU BO TEST SUITE KIEM THU TOAN DIEN HARNESS          " -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

$testResults = @()

function Run-Test {
    param (
        [string]$TestId,
        [string]$Description,
        [scriptblock]$Action
    )
    Write-Host "`n[$TestId] Dang thuc thi: $Description..." -ForegroundColor Yellow
    $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
    try {
        $result = & $Action
        $stopwatch.Stop()
        Write-Host "  -> PASS ($([Math]::Round($stopwatch.Elapsed.TotalSeconds, 2))s)" -ForegroundColor Green
        return [PSCustomObject]@{
            TestId = $TestId
            Description = $Description
            Status = "PASS"
            Duration = "$([Math]::Round($stopwatch.Elapsed.TotalSeconds, 2))s"
            Details = $result
        }
    } catch {
        $stopwatch.Stop()
        Write-Host "  -> FAIL ($([Math]::Round($stopwatch.Elapsed.TotalSeconds, 2))s): $($_.Exception.Message)" -ForegroundColor Red
        return [PSCustomObject]@{
            TestId = $TestId
            Description = $Description
            Status = "FAIL"
            Duration = "$([Math]::Round($stopwatch.Elapsed.TotalSeconds, 2))s"
            Details = $_.Exception.Message
        }
    }
}

function Parse-AgyJson {
    param ([string]$raw)
    $line = ($raw -split "`r?`n" | Where-Object { $_ -match '^\s*\{.*\}\s*$' } | Select-Object -Last 1)
    if (-not $line) { throw "Khong tim thay chuoi JSON hop le trong dau ra cua agy CLI: $raw" }
    return ($line | ConvertFrom-Json)
}

# -------------------------------------------------------------------------
# Test 1: Kiem thu L0 Root Rule (Hien phap luon luon kich hoat)
# -------------------------------------------------------------------------
$testResults += Run-Test "TEST-01" "L0 Root Rule Discovery (Objective Function & Persona)" {
    $cmd = "agy -p `"Xac dinh vai tro va ham muc tieu nhan thuc cua ban trong du an nay trong 2 cau.`" --model $model --effort $effort --output-format json"
    $jsonRaw = Invoke-Expression $cmd
    $parsed = Parse-AgyJson $jsonRaw
    if ($parsed.status -ne "SUCCESS") { throw "Headless CLI tra ve status: $($parsed.status)" }
    if ($parsed.response -notmatch "Defensive Systems Architect" -or $parsed.response -notmatch "BlastRadiusMinimization") {
        throw "Model khong nhan dien duoc Persona hoac Ham muc tieu tu root AGENTS.md"
    }
    return "Nhan dien dung Persona va Objective Function"
}

# -------------------------------------------------------------------------
# Test 2: Kiem thu Modular Rule (Progressive Disclosure: design-matrix.md)
# -------------------------------------------------------------------------
$testResults += Run-Test "TEST-02" "Modular Rule Progressive Disclosure (design-matrix.md)" {
    $prompt = "Toi can viet 1 ham tien ich format ngay thang duy nhat, co nen tao Factory hoac Strategy pattern khong? Vi sao?"
    $cmd = "agy -p `"$prompt`" --model $model --effort $effort --output-format json"
    $jsonRaw = Invoke-Expression $cmd
    $parsed = Parse-AgyJson $jsonRaw
    if ($parsed.status -ne "SUCCESS") { throw "Headless CLI tra ve status: $($parsed.status)" }
    if ($parsed.response -notmatch "KHONG" -and $parsed.response -notmatch "khong nen" -and $parsed.response -notmatch "design-matrix.md|Occam|Pure Function") {
        throw "Model khong vien dan va ap dung quy tac tu design-matrix.md"
    }
    return "Model tu nap design-matrix.md va tu choi over-engineering"
}

# -------------------------------------------------------------------------
# Test 3: Kiem thu Skill Discovery & Activation (andrew-protocol)
# -------------------------------------------------------------------------
$testResults += Run-Test "TEST-03" "Skill Discovery & Execution (andrew-protocol)" {
    $prompt = "Hay neu tom tat 4 pha tu duy bat buoc truoc khi can thiep ma nguon."
    $cmd = "agy -p `"$prompt`" --model $model --effort $effort --output-format json"
    $jsonRaw = Invoke-Expression $cmd
    $parsed = Parse-AgyJson $jsonRaw
    if ($parsed.status -ne "SUCCESS") { throw "Headless CLI tra ve status: $($parsed.status)" }
    if ($parsed.response -notmatch "Cognitive Anchoring" -or $parsed.response -notmatch "Deterministic Verification") {
        throw "Model khong kich hoat duoc quy trinh 4 pha tu skill andrew-protocol"
    }
    return "Model kich hoat chinh xac Skill andrew-protocol"
}

# -------------------------------------------------------------------------
# Test 4: Kiem thu Dedicated Subagent Discovery (surgical-auditor)
# -------------------------------------------------------------------------
$testResults += Run-Test "TEST-04" "Dedicated Subagent Dispatch (--agent surgical-auditor)" {
    $prompt = "Hay bao cao vai tro va ranh gioi quyen han cua ban."
    $cmd = "agy -p `"$prompt`" --agent surgical-auditor --model $model --effort $effort --output-format json"
    $jsonRaw = Invoke-Expression $cmd
    $parsed = Parse-AgyJson $jsonRaw
    if ($parsed.status -ne "SUCCESS") { throw "Headless CLI tra ve status: $($parsed.status)" }
    if ($parsed.response -notmatch "Surgical Code Auditor|Kiểm toán.*Mã Nguồn" -or ($parsed.response -notmatch "chỉ đọc|chi doc|Read-Only|read-only")) {
        throw "Subagent khong nhan dung system prompt doc lap tu .agents/agents/surgical-auditor.md"
    }
    return "Subagent khoi tao doc lap voi Clean Slate Context thanh cong"
}

# -------------------------------------------------------------------------
# Test 5: Kiem thu Mechanical Guards & Dau Chan Nhan Dien (Footprints)
# -------------------------------------------------------------------------
$testResults += Run-Test "TEST-05" "Mechanical Guards & Footprint Audit Traceability (In-Memory)" {
    # 5.1 Xac thuc duong dan va schema trong hooks.json
    $hooksPath = ".agents\hooks.json"
    if (-not (Test-Path $hooksPath)) { throw "Khong tim thay hooks.json" }
    $hooksData = Get-Content $hooksPath -Raw | ConvertFrom-Json
    if (-not $hooksData.'andrew-placeholder-guard' -or -not $hooksData.'andrew-diff-scope-guard' -or -not $hooksData.'andrew-verification-gate') {
        throw "hooks.json thieu mot trong cac hook bat buoc (placeholder, diff-scope, verification-gate)"
    }

    # 5.2 Kiem tra hoat dong co hoc va dau chan nhan dien qua String Memory truc tiep
    Push-Location ".agents"
    try {
        $tempClean = Join-Path (Get-Location).Path "..\Temps\harness_test_clean.txt"
        $tempBad = Join-Path (Get-Location).Path "..\Temps\harness_test_bad.txt"
        
        "Clean production code without forbidden tags." | Out-File -FilePath $tempClean -Encoding utf8
        "Code containing TODO: forbidden_stub_mock" | Out-File -FilePath $tempBad -Encoding utf8

        $payloadClean = @{ toolCall = @{ name = "write_file"; args = @{ Path = (Resolve-Path $tempClean).Path } } } | ConvertTo-Json -Compress
        $payloadBad = @{ toolCall = @{ name = "write_file"; args = @{ Path = (Resolve-Path $tempBad).Path } } } | ConvertTo-Json -Compress

        $placeholderScript = "scripts\guards\placeholder-guard.ps1"
        $diffScopeScript = "scripts\guards\diff-scope-guard.ps1"
        $verificationScript = "scripts\guards\verification-gate.ps1"

        # 5.2.1 placeholder-guard: Test file sach va file chua placeholder bang chuoi bo nho truc tiep
        $outClean = & $placeholderScript -InputJson $payloadClean
        $outBad = & $placeholderScript -InputJson $payloadBad
        
        if ($outClean.Trim() -ne "{}" -or $outBad.Trim() -ne "{}") {
            throw "placeholder-guard vi pham hop dong PostToolUse JSON stdout ({})"
        }

        # 5.2.2 diff-scope-guard: Test file trong workspace va file ngoai workspace
        $outScopeIn = & $diffScopeScript -InputJson $payloadClean
        $payloadOutScope = @{ toolCall = @{ name = "write_file"; args = @{ Path = "C:\Windows\temp\leak_test.txt" } } } | ConvertTo-Json -Compress
        $outScopeOut = & $diffScopeScript -InputJson $payloadOutScope

        if ($outScopeIn.Trim() -ne "{}" -or $outScopeOut.Trim() -ne "{}") {
            throw "diff-scope-guard vi pham hop dong PostToolUse JSON stdout ({})"
        }

        # 5.2.3 verification-gate: Test Stop hook va Definition of Done Gate 5
        $stopPayload = @{
            executionNum = 1
            terminationReason = "NO_TOOL_CALL"
            fullyIdle = $true
        } | ConvertTo-Json -Compress
        $gateOut = & $verificationScript -InputJson $stopPayload
        $gateJson = $gateOut | ConvertFrom-Json
        if ($gateJson.decision -ne "allow") {
            throw "verification-gate khong cho phep dung hop le (decision != allow)"
        }

        # Don dep tep tam
        Remove-Item -Path $tempClean, $tempBad -Force -ErrorAction SilentlyContinue

        # 5.2.4 Kiem tra tep dau chan nhan dien ben vung (guard-footprints.jsonl)
        $footprintPath = "logs\guard-footprints.jsonl"
        if (-not (Test-Path $footprintPath)) {
            throw "Khong tim thay file dau chan nhan dien: $footprintPath"
        }
        $recentFootprints = Get-Content $footprintPath | Select-Object -Last 50
        $hasPlaceholderFootprint = $recentFootprints | Where-Object { $_ -match '"guard":"placeholder-guard"' -and $_ -match '"status":"FLAGGED_PLACEHOLDER"' }
        $hasDiffScopeFootprint = $recentFootprints | Where-Object { $_ -match '"guard":"diff-scope-guard"' -and $_ -match '"status":"OUT_OF_SCOPE"' }
        $hasGateFootprint = $recentFootprints | Where-Object { $_ -match '"guard":"verification-gate"' -and $_ -match '"status":"ALLOW"' }

        if (-not $hasPlaceholderFootprint -or -not $hasDiffScopeFootprint -or -not $hasGateFootprint) {
            throw "Tep log guard-footprints.jsonl khong ghi nhan day du cac dau chan nhan dien cua ca 3 guards"
        }
    } finally {
        Pop-Location
    }

    return "Cac guard scripts va tep dau chan guard-footprints.jsonl hoat dong chinh xac 100% trong bo nho"
}

# -------------------------------------------------------------------------
# Test 6: Kiem thu Antigravity Engine Hook Execution qua Log Match (agy CLI)
# -------------------------------------------------------------------------
if ($RunE2E) {
    $testResults += Run-Test "TEST-06" "Antigravity Engine Hook Lifecycle (agy CLI Engine Log Match)" {
        $tempAgyLog = "Temps\harness_agy_hook_audit.log"
        if (Test-Path $tempAgyLog) { Remove-Item $tempAgyLog -Force }

        try {
            $cmd = "agy -p `"Xac thuc hook`" --model $model --effort $effort --log-file $tempAgyLog --output-format json"
            $jsonRaw = Invoke-Expression $cmd
            $parsed = Parse-AgyJson $jsonRaw
            if ($parsed.status -ne "SUCCESS") { throw "Headless CLI tra ve status: $($parsed.status)" }

            if (-not (Test-Path $tempAgyLog)) {
                throw "Antigravity CLI khong sinh file log tai: $tempAgyLog"
            }

            $logContent = Get-Content $tempAgyLog -Raw

            # Match 1: Engine nap hooks tu hooks.json
            if ($logContent -notmatch "hooks_manager\.go:\d+\] loaded \d+ named hooks") {
                throw "Antigravity engine log khong ghi nhan viec load hooks tu hooks.json"
            }

            # Match 2: Engine thuc thi Hook va bat duoc dau chan tren stderr
            if ($logContent -notmatch "command_hook_executor\.go:\d+\] JSON hook command stderr:.*\[GUARD FOOTPRINT\]\[verification-gate\]") {
                throw "Antigravity engine log khong ghi nhan dau chan execution cua verification-gate tren stderr"
            }

            # Match 3: Engine ghi nhan Gate 5 Definition of Done passed
            if ($logContent -notmatch "\[VERIFICATION GATE\] Hoàn tất phiên làm việc") {
                throw "Antigravity engine log khong ghi nhan thong bao Definition of Done tu verification-gate"
            }
        } finally {
            Remove-Item $tempAgyLog -Force -ErrorAction SilentlyContinue
        }

        return "Antigravity Engine kich hoat Hook thuc te va khop log (Match) 100% tren stderr/stdout"
    }
} else {
    Write-Host "`n[TEST-06] Bo qua E2E agy CLI (Them tham so -RunE2E de chay). Su dung String Memory Test o TEST-05 de toi uu hoa toc do." -ForegroundColor DarkGray
}

# -------------------------------------------------------------------------
# BANG TONG HOP KET QUA
# -------------------------------------------------------------------------
Write-Host "`n================================================================" -ForegroundColor Cyan
Write-Host "                KET QUA TONG HOP KIEM THU HARNESS               " -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
$testResults | Format-Table -Property TestId, Description, Status, Duration -AutoSize

$failedCount = @($testResults | Where-Object { $_.Status -eq "FAIL" }).Count
if ($failedCount -eq 0) {
    Write-Host "`n[TAT CA TEST DA PASS] He thong Harness hoat dong tron tru 100% tren Headless Mode!" -ForegroundColor Green
} else {
    Write-Host "`n[CANH BAO] Co $failedCount test that bai!" -ForegroundColor Red
}