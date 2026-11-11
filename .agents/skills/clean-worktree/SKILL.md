---
name: "clean-worktree"
description: "Tự động rà soát, dọn dẹp và giải phóng triệt để các Git worktrees mồ côi, các nhánh tạm subagent/* và prune metadata để bảo vệ tài nguyên hệ thống."
category: "git-management"
version: "1.0.0"
author: "Host Orchestrator"
tags: [git, worktree, cleanup, subagent, resource-teardown, clearn-worktree]
---

# Clean Worktree Skill (Resource Teardown & Worktree Pruning)

## 1. Tổng Quan & Mục Tiêu

Khi hệ thống vận hành theo mô hình Multi-Agent cô lập (Mỗi subagent làm việc trên một worktree branch riêng biệt tại `.gemini/antigravity/worktrees/...`), sau khi hoàn thành task hoặc khi server restart, các worktree và nhánh tạm thời có thể bị bỏ rơi (orphan worktrees/branches), gây tốn dung lượng ổ đĩa và phân mảnh Git index.

Skill này cung cấp quy trình và công cụ tự động hóa để:
- Quét và liệt kê 100% worktree đang liên kết với repository.
- Gỡ bỏ an toàn tất cả các worktree tạm thời của subagent.
- Thu hồi metadata rác (`git worktree prune`).
- Xóa sạch tất cả các nhánh tạm có tiền tố `subagent-*` đã hoàn tất.
- Khôi phục trạng thái Clean Slate cho nhánh làm việc chính.

---

## 2. Khi Nào Kích Hoạt?

- Khi người dùng yêu cầu: `"dọn dẹp worktree"`, `"clean worktree"`, `"clearn-worktree"`, `"giải phóng worktree"`, `"xóa nhánh subagent"`.
- Trước khi đóng phiên làm việc lớn hoặc sau khi merge hoàn tất các Phase.
- Sau khi có thông báo `[Notice] All your subagents and background tasks have been stopped due to server restart`.

---

## 3. Quy Trình Thực Thi 5 Bước Chuẩn Kiến Trúc

### Bước 1: Liệt kê các Worktrees Hiện Hữu
```bash
git worktree list
```
*Ghi nhận đường dẫn của từng worktree. Chỉ giữ lại duy nhất worktree chính (thư mục dự án hiện tại).*

### Bước 2: Gỡ Bỏ Các Worktree Tạm Của Subagent
Với mỗi worktree nằm trong thư mục `.gemini/antigravity/worktrees/` hoặc có tên bắt đầu bằng `subagent-`:
```bash
git worktree remove --force "<đường_dẫn_worktree>"
```

### Bước 3: Cắt Tỉa Metadata Rác (Worktree Prune)
```bash
git worktree prune -v
```
*Lệnh này giải phóng toàn bộ con trỏ và metadata mồ côi trong `.git/worktrees/`.*

### Bước 4: Xóa Các Nhánh Tạm Của Subagent
```bash
# Kiểm tra danh sách nhánh subagent
git branch --list "subagent*"

# Xóa triệt để các nhánh tạm này
git branch -D <tên_nhánh>
```

### Bước 5: Xác Thực Trạng Thái Cơ Học (Verification Gate)
```bash
git worktree list
git status
```
*Đảm bảo kết quả `git worktree list` chỉ còn lại 1 dòng duy nhất trỏ về thư mục dự án chính và working tree sạch 100%.*

---

## 4. Script Tự Động Hóa 1 Lệnh (One-Shot Execution)

### Dành cho PowerShell (Windows):
Chạy script có sẵn tại:
```powershell
powershell -ExecutionPolicy Bypass -File .agents/skills/clean-worktree/scripts/clean-worktree.ps1
```

### Dành cho Bash (Linux / macOS / Git Bash):
```bash
bash .agents/skills/clean-worktree/scripts/clean-worktree.sh
```

---

## 5. Ranh Giới Cấm Tuyệt Đối (Negative Space)

- **CẤM** xóa worktree chính (dòng đầu tiên trong `git worktree list` trỏ tới repo root).
- **CẤM** xóa các nhánh chính của dự án (`main`, `master`, `staging`, `develop` hoặc các nhánh `feature/*` chưa merge).
- Bắt buộc kiểm tra `git status` trên nhánh chính trước khi thực hiện để đảm bảo không xóa nhầm công việc đang dở dang.

