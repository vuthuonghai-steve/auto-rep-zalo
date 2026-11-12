<#
.SYNOPSIS
    Kiểm định cơ học cấu hình tác nhân trong .agents/ (Không kiểm tra model tier).
.DESCRIPTION
    Kiểm tra tính hợp lệ cú pháp và ranh giới cấm:
    1. Kiểm tra tiền tố cấm trong khai báo skills (.agents/skills/ -> lỗi).
    2. Quét công cụ deprecated (list_dir, grep_search, find_by_name, ask_permission).
    3. Kiểm tra YAML Frontmatter cơ bản.
    Trả về Exit Code 0 nếu hợp lệ, Exit Code 1 nếu có vi phạm.
#>

param(
    [string]$TargetDir = "$PSScriptRoot\..\agents"
)

$ErrorCount = 0
$WarningCount = 0

if (-not (Test-Path $TargetDir)) {
    Write-Host "[!] Thu muc $TargetDir khong ton tai." -ForegroundColor Yellow
    exit 0
}

$agentFiles = Get-ChildItem -Path $TargetDir -Filter "*.md" -File

Write-Host "=== KIEM DINH CO HOC CAU HINH TAC NHAN (.agents/agents) ===" -ForegroundColor Cyan
Write-Host "So luong file can kiem tra: $($agentFiles.Count)`n"

$deprecatedTools = @('list_dir', 'grep_search', 'find_by_name', 'ask_permission')

foreach ($file in $agentFiles) {
    $content = Get-Content -Path $file.FullName -Raw
    $fileName = $file.Name
    $hasFileError = $false

    # 1. Kiem tra Frontmatter
    if ($content -notmatch '(?s)^---\r?\n(.*?)\r?\n---') {
        Write-Host "[FAIL] $fileName : Thieu YAML Frontmatter hop le." -ForegroundColor Red
        $ErrorCount++
        continue
    }

    $frontmatter = $matches[1]

    # 2. Kiem tra tien to skills (CAM: .agents/skills/ hoac /skills/)
    if ($frontmatter -match '(?m)^\s*-\s*(\.agents\/skills\/|\/skills\/)') {
        Write-Host "[FAIL] $fileName : Khai bao skill chua tien to cam (phat hien .agents/skills/ hoac /skills/). Phai la skills/<name>." -ForegroundColor Red
        $ErrorCount++
        $hasFileError = $true
    }

    # 3. Kiem tra cong cu deprecated
    foreach ($tool in $deprecatedTools) {
        if ($content -match "(?i)\b$tool\b") {
            Write-Host "[WARN] $fileName : Chua cong cu deprecated '$tool'. Nen thay the bang cong cu chuan." -ForegroundColor Yellow
            $WarningCount++
        }
    }

    if (-not $hasFileError) {
        Write-Host "[PASS] $fileName" -ForegroundColor Green
    }
}

Write-Host "`n=== KET QUA KIEM TRA ===" -ForegroundColor Cyan
Write-Host "Loi (Errors)    : $ErrorCount" -ForegroundColor $(if ($ErrorCount -eq 0) { "Green" } else { "Red" })
Write-Host "Canh bao (Warns): $WarningCount" -ForegroundColor $(if ($WarningCount -eq 0) { "Green" } else { "Yellow" })

if ($ErrorCount -gt 0) {
    exit 1
} else {
    exit 0
}
