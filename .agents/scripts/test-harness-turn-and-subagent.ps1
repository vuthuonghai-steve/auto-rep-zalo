<#
.SYNOPSIS
    Bộ kiểm duyệt rào chắn trước thực thi (Pre-Implementation Verification Gate)
    cho Kiến trúc Turn & Subagent Harness.
.DESCRIPTION
    Mã hóa 6 cổng kiểm chứng cơ học nhị phân theo nguyên lý Test-First:
    - Gate 1: Registry SSOT Check (.agents/Docs/agy-allowed-tools.yaml)
    - Gate 2: Archive & Gitignore Verification (.agents/archives/ & .gitignore)
    - Gate 3: Directory Governance (Zero flat .md files in .agents/agents/)
    - Gate 4: Tool Registry Compliance (Zero call_mcp_tool, Zero legacy tools)
    - Gate 5: IPC Mechanical Protocol (Explicit send_message with Conversation ID)
    - Gate 6: Go Engine Discovery (agy agents & Zero AgentBasePath warnings in cli.log)
    
    Exit Code: 0 nếu 100% Gate PASS, 1 nếu có bất kỳ Gate nào FAIL.
#>

param(
    [string]$WorkspaceRoot = "c:\Users\ADMIN\Documents\workspace\Sales\EXTENSIONS"
)

$ErrorCount = 0
$TotalGates = 6
$PassedGates = 0

Write-Host "`n=====================================================================" -ForegroundColor Cyan
Write-Host "   PRE-IMPLEMENTATION TEST-FIRST VERIFICATION GATE: TURN & SUBAGENT   " -ForegroundColor Cyan
Write-Host "=====================================================================`n" -ForegroundColor Cyan

# -----------------------------------------------------------------------------
# GATE 1: REGISTRY SSOT CHECK
# -----------------------------------------------------------------------------
Write-Host "[GATE 1] Kiểm tra sự tồn tại của bảng đăng ký công cụ agy-allowed-tools.yaml..." -NoNewline
$registryPath = Join-Path $WorkspaceRoot ".agents\Docs\agy-allowed-tools.yaml"
if (Test-Path $registryPath) {
    Write-Host " [PASS]" -ForegroundColor Green
    $PassedGates++
} else {
    Write-Host " [FAIL]" -ForegroundColor Red
    Write-Host "         -> Không tìm thấy: $registryPath" -ForegroundColor DarkRed
    $ErrorCount++
}

# -----------------------------------------------------------------------------
# GATE 2: ARCHIVE & GITIGNORE VERIFICATION
# -----------------------------------------------------------------------------
Write-Host "[GATE 2] Kiểm tra thư mục archives và cấu hình .gitignore..." -NoNewline
$archivesDir = Join-Path $WorkspaceRoot ".agents\archives\agents_flat_backup"
$gitignorePath = Join-Path $WorkspaceRoot ".gitignore"

$gate2Passed = $true
if (-not (Test-Path $archivesDir)) {
    $gate2Passed = $false
    $failReason = "Thư mục $archivesDir chưa tồn tại."
}

if (Test-Path $gitignorePath) {
    $gitignoreContent = Get-Content -Path $gitignorePath -Raw
    if ($gitignoreContent -notmatch '\.agents\/archives\/') {
        $gate2Passed = $false
        $failReason = ".gitignore chưa chứa khai báo .agents/archives/"
    }
} else {
    $gate2Passed = $false
    $failReason = ".gitignore không tồn tại."
}

if ($gate2Passed) {
    Write-Host " [PASS]" -ForegroundColor Green
    $PassedGates++
} else {
    Write-Host " [FAIL]" -ForegroundColor Red
    Write-Host "         -> $failReason" -ForegroundColor DarkRed
    $ErrorCount++
}

# -----------------------------------------------------------------------------
# GATE 3: DIRECTORY GOVERNANCE & ZERO FLAT FILES
# -----------------------------------------------------------------------------
Write-Host "[GATE 3] Kiểm tra kỷ luật thư mục: 0 file phẳng tại root của .agents/agents/..." -NoNewline
$agentsDir = Join-Path $WorkspaceRoot ".agents\agents"
$flatFiles = Get-ChildItem -Path $agentsDir -Filter "*.md" -File -ErrorAction SilentlyContinue

$requiredAgents = @(
    "host-orchestrator",
    "surgical-implementer",
    "surgical-auditor",
    "deep-codebase-investigator",
    "deep-performance-profiler",
    "deep-security-analyst",
    "spec-analyst-planner",
    "worktree-integrator"
)

$gate3Passed = $true
$gate3Failures = @()

if ($flatFiles.Count -gt 0) {
    $gate3Passed = $false
    $gate3Failures += "Phát hiện $($flatFiles.Count) file .md phẳng tại root: $($flatFiles.Name -join ', ')"
}

foreach ($ag in $requiredAgents) {
    $agPath = Join-Path $agentsDir "$ag\agent.md"
    if (-not (Test-Path $agPath)) {
        $gate3Passed = $false
        $gate3Failures += "Thiếu gói chuẩn: .agents/agents/$ag/agent.md"
    }
}

if ($gate3Passed) {
    Write-Host " [PASS]" -ForegroundColor Green
    $PassedGates++
} else {
    Write-Host " [FAIL]" -ForegroundColor Red
    foreach ($f in $gate3Failures) {
        Write-Host "         -> $f" -ForegroundColor DarkRed
    }
    $ErrorCount++
}

# -----------------------------------------------------------------------------
# GATE 4: TOOL REGISTRY COMPLIANCE (ZERO call_mcp_tool, ZERO LEGACY TOOLS)
# -----------------------------------------------------------------------------
Write-Host "[GATE 4] Kiểm tra tuân thủ Tool Registry (Cấm call_mcp_tool & legacy tools)..." -NoNewline
$legacyTools = @("view_file", "list_dir", "grep_search", "find_by_name", "write_to_file", "replace_file_content", "multi_replace_file_content")
$gate4Passed = $true
$gate4Failures = @()

$allAgentMdFiles = Get-ChildItem -Path $agentsDir -Filter "agent.md" -Recurse -File -ErrorAction SilentlyContinue

if ($allAgentMdFiles.Count -eq 0) {
    $gate4Passed = $false
    $gate4Failures += "Không tìm thấy file agent.md nào để kiểm tra."
}

foreach ($file in $allAgentMdFiles) {
    $content = Get-Content -Path $file.FullName -Raw
    if ($content -match '(?s)^---\r?\n(.*?)\r?\n---') {
        $frontmatter = $matches[1]
        
        # Check forbidden call_mcp_tool
        if ($frontmatter -match '(?m)^\s*-\s*call_mcp_tool\b') {
            $gate4Passed = $false
            $gate4Failures += "$($file.Directory.Name)/agent.md: Khai báo cấm 'call_mcp_tool' trong tools:"
        }

        # Check legacy tools
        foreach ($lt in $legacyTools) {
            if ($frontmatter -match "(?m)^\s*-\s*$lt\b") {
                $gate4Passed = $false
                $gate4Failures += "$($file.Directory.Name)/agent.md: Khai báo legacy tool '$lt' trong tools:"
            }
        }
    }
}

if ($gate4Passed) {
    Write-Host " [PASS]" -ForegroundColor Green
    $PassedGates++
} else {
    Write-Host " [FAIL]" -ForegroundColor Red
    foreach ($f in $gate4Failures) {
        Write-Host "         -> $f" -ForegroundColor DarkRed
    }
    $ErrorCount++
}

# -----------------------------------------------------------------------------
# GATE 5: IPC MECHANICAL PROTOCOL (EXPLICIT send_message WITH CONVERSATION ID)
# -----------------------------------------------------------------------------
Write-Host "[GATE 5] Kiểm tra giao thức IPC: Xác thực send_message tường minh, cấm post_message ảo..." -NoNewline
$orchestratorMd = Join-Path $agentsDir "host-orchestrator\agent.md"
$gate5Passed = $true
$gate5Failures = @()

if (Test-Path $orchestratorMd) {
    $orchContent = Get-Content -Path $orchestratorMd -Raw
    
    # Check if send_message is mandated
    if ($orchContent -notmatch 'send_message') {
        $gate5Passed = $false
        $gate5Failures += "host-orchestrator/agent.md thiếu chỉ thị vận hành send_message cơ học."
    }

    # Prohibit phantom post_message
    if ($orchContent -match 'post_message') {
        $gate5Passed = $false
        $gate5Failures += "host-orchestrator/agent.md chứa công cụ giả tưởng 'post_message'."
    }
} else {
    $gate5Passed = $false
    $gate5Failures += "Không tìm thấy $orchestratorMd."
}

if ($gate5Passed) {
    Write-Host " [PASS]" -ForegroundColor Green
    $PassedGates++
} else {
    Write-Host " [FAIL]" -ForegroundColor Red
    foreach ($f in $gate5Failures) {
        Write-Host "         -> $f" -ForegroundColor DarkRed
    }
    $ErrorCount++
}

# -----------------------------------------------------------------------------
# GATE 6: GO ENGINE DISCOVERY & ZERO-WARNING CHECK
# -----------------------------------------------------------------------------
Write-Host "[GATE 6] Kiểm tra Go Discovery Engine (agy agents & zero AgentBasePath warning)..." -NoNewline
$gate6Passed = $true
$gate6Failures = @()

try {
    $cliLogPath = "C:\Users\ADMIN\.gemini\antigravity\cli.log"
    $initialLogLength = if (Test-Path $cliLogPath) { (Get-Item $cliLogPath).Length } else { 0 }

    # Run agy agents
    $agyAgentsOutput = (agy agents 2>&1) -join "`n"
    
    # Check if all 8 agents are listed
    foreach ($ag in $requiredAgents) {
        if ($agyAgentsOutput -notmatch "(?m)^$([regex]::Escape($ag))\s*$") {
            $gate6Passed = $false
            $gate6Failures += "Go Engine 'agy agents' không tìm thấy agent: $ag"
        }
    }

    # Inspect cli.log tail for AgentBasePath warnings
    if (Test-Path $cliLogPath) {
        $recentLogs = Get-Content -Path $cliLogPath -Tail 40
        $warningLines = $recentLogs | Where-Object { $_ -match "Cannot resolve agent-relative path.*AgentBasePath is not set" }
        if ($warningLines.Count -gt 0) {
            $gate6Passed = $false
            $gate6Failures += "Phát hiện $($warningLines.Count) cảnh báo 'AgentBasePath is not set' trong cli.log!"
        }
    }
} catch {
    $gate6Passed = $false
    $gate6Failures += "Lỗi khi gọi agy CLI: $_"
}

if ($gate6Passed) {
    Write-Host " [PASS]" -ForegroundColor Green
    $PassedGates++
} else {
    Write-Host " [FAIL]" -ForegroundColor Red
    foreach ($f in $gate6Failures) {
        Write-Host "         -> $f" -ForegroundColor DarkRed
    }
    $ErrorCount++
}

# -----------------------------------------------------------------------------
# SUMMARY & EXIT CODE
# -----------------------------------------------------------------------------
Write-Host "`n---------------------------------------------------------------------" -ForegroundColor Cyan
Write-Host "KẾT QUẢ KIỂM DUYỆT RÀO CHẮN: $PassedGates/$TotalGates Gates PASSED." -ForegroundColor $(if ($ErrorCount -eq 0) { "Green" } else { "Red" })
Write-Host "Tổng lỗi vi phạm: $ErrorCount" -ForegroundColor $(if ($ErrorCount -eq 0) { "Green" } else { "Red" })
Write-Host "---------------------------------------------------------------------`n" -ForegroundColor Cyan

if ($ErrorCount -gt 0) {
    exit 1
} else {
    exit 0
}
