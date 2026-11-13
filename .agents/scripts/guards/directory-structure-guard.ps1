# Hook Script: Directory Structure & Layer Discipline Guard
# Mục tiêu: Cưỡng chế cơ học giới hạn độ sâu (Max Depth <= 2) và cấm import chéo giữa các màn hình

param (
    [string]$TargetDir = "src/screens"
)

$ErrorCount = 0
$RepoRoot = (Get-Location).Path
$ScreensPath = Join-Path $RepoRoot $TargetDir

if (-not (Test-Path $ScreensPath)) {
    Write-Host "[GUARD-SKIP] Khong tim thay thu muc $TargetDir" -ForegroundColor Yellow
    exit 0
}

Write-Host "[GUARD-START] Kiem tra ky luat cau truc thu muc tai $TargetDir..." -ForegroundColor Cyan

# 1. Kiem tra Max Depth <= 2 trong src/screens
# Cấu trúc hợp lệ: src/screens/<module>/components/<file>.tsx (độ sâu tương đối = 2 thư mục con tính từ screens)
Get-ChildItem -Path $ScreensPath -Recurse -File | ForEach-Object {
    $RelativePath = $_.FullName.Substring($ScreensPath.Length).TrimStart("\", "/")
    $Segments = $RelativePath -split '[\\/]'

    # Segments: 
    # [0] = module (vd: menu, settings, common)
    # [1] = file hoặc "components"
    # [2] = file trong components
    # Nếu segments > 3 tức là có thư mục con lồng sâu bên trong components
    if ($Segments.Length -gt 3) {
        Write-Host "[DIR-ERROR] Vi pham Max Depth (Qua 2 cap thu muc): $RelativePath" -ForegroundColor Red
        $ErrorCount++
    }
}

# 2. Kiem tra Cross-Domain Component Import
# Cấm: src/screens/A/ import từ ../B/components/...
Get-ChildItem -Path $ScreensPath -Recurse -Filter "*.tsx" | ForEach-Object {
    $FilePath = $_.FullName
    $Lines = Get-Content -Path $FilePath
    $LineNumber = 0

    foreach ($Line in $Lines) {
        $LineNumber++
        if ($Line -match "import\s+.*from\s+['""]\.\./([^/'""]+)/components") {
            $TargetModule = $matches[1]
            Write-Host "[IMPORT-ERROR] Phap hien cross-screen component import tai: $($_.Name):$LineNumber -> ../$TargetModule/components" -ForegroundColor Red
            Write-Host "   -> Huong dan: Nang cap component len 'src/components/ui/' hoac 'src/screens/common/'" -ForegroundColor Yellow
            $ErrorCount++
        }
    }
}

# 3. Kiem dinh ket qua
if ($ErrorCount -gt 0) {
    Write-Host "[GUARD-FAIL] Phat hien $ErrorCount loi vi pham kien truc thu muc!" -ForegroundColor Red
    exit 1
}

Write-Host "[GUARD-PASS] Toan bo cau truc thu muc $TargetDir dat chuan co hoc 100%." -ForegroundColor Green
exit 0

