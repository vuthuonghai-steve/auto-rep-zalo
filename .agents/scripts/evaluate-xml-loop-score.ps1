# .agents/scripts/evaluate-xml-loop-score.ps1
# Mechanical Scoring Gate for Direct XML + YAML Evolution Loop
# Enforces Zero-Response-Illusion, XML Syntax Validity and Model Performance Stability

param (
    [int]$LoopId,
    [string]$HardRulePath,
    [string]$SoftRulePath,
    [string]$SubagentAuditPath,
    [string]$EngineLogPath,
    [double]$NewTokensAverage = 0,
    [double]$NewLatencySeconds = 0
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

$scriptDir = $PSScriptRoot
$repoRoot = [System.IO.Path]::GetFullPath((Join-Path $scriptDir "..\.."))
$tempsDir = Join-Path $repoRoot ".agents\Temps"
$ledgerPath = Join-Path $tempsDir "score-ledger-xml.json"

if (-not (Test-Path $ledgerPath)) {
    Write-Error "[GATE ERROR] Khong tim thay score-ledger-xml.json tai: $ledgerPath"
    exit 1
}

$ledger = Get-Content $ledgerPath -Raw | ConvertFrom-Json
$currentScore = $ledger.current_score
$baselineLatency = $ledger.baseline_metrics.average_latency_s

Write-Host "`n======================================================================" -ForegroundColor Cyan
Write-Host "  MECHANICAL XML EVALUATION GATE: LOOP ${LoopId} (Current Score: $currentScore) " -ForegroundColor Cyan
Write-Host "======================================================================" -ForegroundColor Cyan

$gateResults = @{
    HardRuleValid = $false
    SoftRuleValid = $false
    EngineLogVerified = $false
    SubagentAuditPassed = $false
    NoDegradation = $true
    DegradationPct = 0.0
    ScoreDelta = 0
    Reasons = @()
}

# 1. Kiem tra Soft Rule
if ($SoftRulePath -and (Test-Path $SoftRulePath)) {
    $softContent = Get-Content $SoftRulePath -Raw
    if ($softContent -match '^---\s*[\r\n]+([\s\S]*?)[\r\n]+---') {
        $frontmatter = $matches[1]
        if ($frontmatter -match 'trigger:' -and $frontmatter -match 'description:') {
            $gateResults.SoftRuleValid = $true
            Write-Host "  [OK] Soft Rule hop le (YAML frontmatter + content): $SoftRulePath" -ForegroundColor Green
        } else {
            $gateResults.Reasons += "Soft Rule thieu trigger hoac description trong frontmatter"
            Write-Host "  [FAIL] Soft Rule thieu truong bat buoc: $SoftRulePath" -ForegroundColor Red
        }
    } else {
        $gateResults.Reasons += "Soft Rule khong co YAML frontmatter hop le"
        Write-Host "  [FAIL] Soft Rule thieu frontmatter fence: $SoftRulePath" -ForegroundColor Red
    }
} else {
    $gateResults.Reasons += "Khong tim thay Soft Rule tai: $SoftRulePath"
    Write-Host "  [FAIL] Khong tim thay Soft Rule: $SoftRulePath" -ForegroundColor Red
}

# 2. Kiem tra Hard Rule
if ($HardRulePath -and (Test-Path $HardRulePath)) {
    $hardContent = Get-Content $HardRulePath -Raw
    if ($hardContent.Trim().Length -gt 50) {
        $gateResults.HardRuleValid = $true
        Write-Host "  [OK] Hard Rule co hoc ton tai va hop le: $HardRulePath" -ForegroundColor Green
    } else {
        $gateResults.Reasons += "Hard Rule qua ngan hoac rong"
        Write-Host "  [FAIL] Hard Rule qua ngan: $HardRulePath" -ForegroundColor Red
    }
} else {
    $gateResults.Reasons += "Khong tim thay Hard Rule tai: $HardRulePath"
    Write-Host "  [FAIL] Khong tim thay Hard Rule: $HardRulePath" -ForegroundColor Red
}

# 3. Kiem tra Engine Log Thuc Te
if ($EngineLogPath -and (Test-Path $EngineLogPath)) {
    $engineLog = Get-Content $EngineLogPath -Raw
    if ($engineLog -match 'cannot unmarshal|syntax error in frontmatter|failed to parse plugin rule file') {
        $gateResults.Reasons += "Phat hien loi nghiem trong trong engine log: syntax error/cannot unmarshal"
        Write-Host "  [FAIL] Engine Log phat hien loi parse rule: $EngineLogPath" -ForegroundColor Red
    } else {
        $gateResults.EngineLogVerified = $true
        Write-Host "  [OK] Engine Log xac nhan 0 loi syntax/parse tu he sinh thai: $EngineLogPath" -ForegroundColor Green
    }
} else {
    $gateResults.Reasons += "Khong tim thay Engine Log de doi chieu chung cu co hoc"
    Write-Host "  [FAIL] Thieu Engine Log xac thuc: $EngineLogPath" -ForegroundColor Red
}

# 4. Kiem tra Bao Cao Tham Dinh Doc Lap Cua Subagent
if ($SubagentAuditPath -and (Test-Path $SubagentAuditPath)) {
    $auditContent = Get-Content $SubagentAuditPath -Raw
    if ($auditContent -match 'AUDIT_RESULT:\s*PASS' -and $auditContent -match 'SUBAGENT_SIGNATURE:') {
        $gateResults.SubagentAuditPassed = $true
        Write-Host "  [OK] Subagent Audit doc lap xac nhan PASS voi chu ky co hoc: $SubagentAuditPath" -ForegroundColor Green
    } else {
        $gateResults.Reasons += "Subagent Audit khong dat AUDIT_RESULT: PASS hoac thieu signature"
        Write-Host "  [FAIL] Subagent Audit chua chap thuan: $SubagentAuditPath" -ForegroundColor Red
    }
} else {
    $gateResults.Reasons += "Khong tim thay bao cao tham dinh doc lap cua Subagent tai: $SubagentAuditPath"
    Write-Host "  [FAIL] Thieu bao cao Subagent Audit: $SubagentAuditPath" -ForegroundColor Red
}

# 5. Kiem tra Do Suy Giam Suc Manh Model (> 20%)
if ($NewLatencySeconds -gt 0 -and $baselineLatency -gt 0) {
    $latencyChangePct = [Math]::Round((($NewLatencySeconds - $baselineLatency) / $baselineLatency) * 100, 2)
    $gateResults.DegradationPct = $latencyChangePct

    if ($latencyChangePct -gt 20.0) {
        $gateResults.NoDegradation = $false
        $gateResults.Reasons += "Canh bao suy giam suc manh model: Do tre tang $latencyChangePct% (vuot nguong 20%)"
        Write-Host "  [DEGRADATION DETECTED] Do tre tang $latencyChangePct% (> 20%)!" -ForegroundColor Red
    } else {
        Write-Host "  [OK] Hieu nang on dinh: Bien thien latency $latencyChangePct% (<= 20%)" -ForegroundColor Green
    }
}

# 6. Quyet Dinh Cong / Tru Diem
if (-not $gateResults.NoDegradation) {
    $gateResults.ScoreDelta = -1
    Write-Host "  -> KET QUA GATE: TRU 1 DIEM (-1) do suy giam suc manh model > 20%!" -ForegroundColor Red
} elseif ($gateResults.HardRuleValid -and $gateResults.SoftRuleValid -and $gateResults.EngineLogVerified -and $gateResults.SubagentAuditPassed) {
    $gateResults.ScoreDelta = 1
    Write-Host "  -> KET QUA GATE: CONG 1 DIEM (+1)! Vuot qua 100% tieu chi va gate kiem duyet co hoc." -ForegroundColor Green
} else {
    $gateResults.ScoreDelta = 0
    Write-Host "  -> KET QUA GATE: KHONG CONG DIEM (+0). Cac ly do: $($gateResults.Reasons -join '; ')" -ForegroundColor Yellow
}

# 7. Cap nhat Score Ledger
$newScore = [Math]::Max(0, ($currentScore + $gateResults.ScoreDelta))
$ledger.current_score = $newScore
$ledger.loops_completed = $LoopId

$historyEntry = [PSCustomObject]@{
    loop_id = $LoopId
    timestamp = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
    hard_rule = $HardRulePath
    soft_rule = $SoftRulePath
    subagent_audit = $SubagentAuditPath
    engine_log = $EngineLogPath
    score_delta = $gateResults.ScoreDelta
    resulting_score = $newScore
    degradation_pct = $gateResults.DegradationPct
    status = if ($gateResults.ScoreDelta -gt 0) { "SCORE_INCREMENTED" } elseif ($gateResults.ScoreDelta -lt 0) { "SCORE_PENALIZED" } else { "SCORE_UNCHANGED" }
    reasons = $gateResults.Reasons
}

$ledger.history += $historyEntry
$ledger | ConvertTo-Json -Depth 10 | Out-File -FilePath $ledgerPath -Encoding utf8

Write-Host "`n[SCORE UPDATE] Diem hien tai sau Loop ${LoopId}: $newScore / $($ledger.target_score)" -ForegroundColor Cyan
Write-Host "======================================================================" -ForegroundColor Cyan

return $newScore

