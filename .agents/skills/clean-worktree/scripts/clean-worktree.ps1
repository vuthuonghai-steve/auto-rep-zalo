<#
.SYNOPSIS
    Tự động hóa dọn dẹp toàn bộ Git Worktrees tạm thời và các nhánh subagent.
.DESCRIPTION
    Script này quét danh sách git worktrees, gỡ bỏ tất cả các worktrees con được tạo bởi subagents,
    chạy prune metadata và xóa toàn bộ các nhánh có tiền tố 'subagent-'.
#>

[CmdletBinding()]
param (
    [switch]$Force = $true
)

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " [CLEAN-WORKTREE] BẮT ĐẦU DỌN DẸP GIT WORKTREES & BRANCHES" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Lấy danh sách worktree hiện có
$repoRoot = (git rev-parse --show-toplevel).Trim()
Write-Host "[1/4] Thư mục gốc dự án: $repoRoot" -ForegroundColor Gray

$worktrees = git worktree list --porcelain
$currentPath = ""

$worktreesToRemove = @()
$lines = git worktree list

foreach ($line in $lines) {
    if ($line -match '^(\S+)\s+[0-9a-f]+\s+\[(.+)\]$') {
        $path = $matches[1]
        $branch = $matches[2]
        
        # Bỏ qua worktree chính
        $normPath = [System.IO.Path]::GetFullPath($path).TrimEnd('\', '/')
        $normRoot = [System.IO.Path]::GetFullPath($repoRoot).TrimEnd('\', '/')
        
        if ($normPath -ne $normRoot) {
            $worktreesToRemove += [PSCustomObject]@{
                Path = $path
                Branch = $branch
            }
        }
    }
}

# 2. Gỡ bỏ các worktree tạm
if ($worktreesToRemove.Count -gt 0) {
    Write-Host "[2/4] Phát hiện $($worktreesToRemove.Count) worktree tạm cần gỡ bỏ:" -ForegroundColor Yellow
    foreach ($wt in $worktreesToRemove) {
        Write-Host "  -> Gỡ bỏ: $($wt.Path)" -ForegroundColor Yellow
        git worktree remove --force "$($wt.Path)" 2>$null
    }
} else {
    Write-Host "[2/4] Không có worktree tạm nào cần gỡ bỏ." -ForegroundColor Green
}

# 3. Prune metadata rác
Write-Host "[3/4] Cắt tỉa metadata mồ côi (git worktree prune)..." -ForegroundColor Cyan
git worktree prune -v

# 4. Xóa sạch các nhánh tạm của subagents
Write-Host "[4/4] Quét các nhánh tạm subagent-*..." -ForegroundColor Cyan
$subagentBranches = git branch --list "subagent*" | ForEach-Object { $_.Trim().TrimStart('*').Trim() }

if ($subagentBranches) {
    foreach ($b in $subagentBranches) {
        if (-not [string]::IsNullOrWhiteSpace($b)) {
            Write-Host "  -> Xóa nhánh tạm: $b" -ForegroundColor Red
            git branch -D $b 2>$null
        }
    }
} else {
    Write-Host "  -> Không còn nhánh subagent tạm nào tồn tại." -ForegroundColor Green
}

Write-Host "==========================================================" -ForegroundColor Green
Write-Host " [CLEAN-WORKTREE] HOÀN TẤT DỌN DẸP 100% SẠCH SẼ!" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green

git worktree list

