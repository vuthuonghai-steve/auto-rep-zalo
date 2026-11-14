#!/usr/bin/env bash
# ==============================================================================
# Script tự động dọn dẹp Git Worktrees tạm và các nhánh subagent
# ==============================================================================

set -e

echo "=== [CLEAN-WORKTREE] BẮT ĐẦU DỌN DẸP GIT WORKTREES & BRANCHES ==="

REPO_ROOT="$(git rev-parse --show-toplevel)"
echo "[1/4] Thư mục gốc: $REPO_ROOT"

# Gỡ bỏ các worktrees tạm
echo "[2/4] Đang quét và gỡ bỏ worktrees tạm..."
git worktree list --porcelain | grep "^worktree " | cut -d' ' -f2- | while read -r wt_path; do
    if [ "$wt_path" != "$REPO_ROOT" ]; then
        if [[ "$wt_path" =~ \.gemini/antigravity/worktrees ]] || [[ "$wt_path" =~ subagent- ]]; then
            echo "  -> Gỡ bỏ worktree: $wt_path"
            git worktree remove --force "$wt_path" || true
        fi
    fi
done

# Prune metadata
echo "[3/4] Cắt tỉa metadata mồ côi (git worktree prune)..."
git worktree prune -v

# Xóa các nhánh tạm subagent-*
echo "[4/4] Xóa các nhánh tạm subagent-*..."
git branch --list "subagent*" | while read -r branch; do
    clean_branch=$(echo "$branch" | tr -d '* ')
    if [ -n "$clean_branch" ]; then
        echo "  -> Xóa nhánh: $clean_branch"
        git branch -D "$clean_branch" || true
    fi
done

echo "=== [CLEAN-WORKTREE] HOÀN TẤT DỌN DẸP 100% SẠCH SẼ! ==="
git worktree list

