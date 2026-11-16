# Legacy PowerShell Hook Scripts Backup & Archive Manifest

**Feature**: `004-hook-runtime-python` (Task T007)  
**Date**: 2026-11-16  
**Status**: DEPRECATED & ARCHIVED  

---

## 1. Mục Đích & Bối Cảnh Chuyển Đổi (Context)

Trước Feature 004, hệ thống Antigravity Hook Runtime sử dụng các wrapper script PowerShell (`.ps1`) làm trung gian kích hoạt qua lệnh `powershell -ExecutionPolicy Bypass -File ...`.
Cơ chế này phát sinh các điểm nghẽn nghiêm trọng:
1. **Độ trễ khởi động tiến trình**: `powershell.exe` tốn 150ms – 250ms cho mỗi thao tác tool call, gây trễ tích lũy hàng chục giây trong mỗi phiên làm việc.
2. **Lỗi sai lệch khế ước Go Engine**: Script Stop hook cũ xuất `allow`/`deny` thay vì `stop`/`continue` theo struct của Go Core Engine (`agy.exe`).
3. **Phân mảnh kiến trúc**: 3 script kiểm tra PostToolUse chạy nối tiếp gây lặp lại I/O và parsing STDIN.

Toàn bộ hệ thống Hook Runtime hiện đã được chuyển đổi hoàn toàn sang **Pure Python Standard Library (3.9+)** trực tiếp dưới sự điều phối của `.agents/hooks.json`.

---

## 2. Bảng Đối Chiếu Thay Thế (Legacy to Python Migration Matrix)

| Hook Event | Legacy PowerShell Script | Python Runtime Replacement | Trạng Thái | Hiệu Năng Đạt Được |
| :--- | :--- | :--- | :--- | :--- |
| **PreToolUse** | `dispatcher.ps1` | `domains/engine_invariants/delegation_sanitizer.py` | ACTIVE | < 5ms (giảm > 95%) |
| **PostToolUse** | `placeholder-guard.ps1` | `workspace_guard.py` | ACTIVE | < 25ms (giảm > 85%) |
| **PostToolUse** | `diff-scope-guard.ps1` | `workspace_guard.py` (hợp nhất) | ACTIVE | Hợp nhất trong 1 lần chạy |
| **PostToolUse** | `directory-structure-guard.ps1` | `workspace_guard.py` (hợp nhất) | ACTIVE | Hợp nhất trong 1 lần chạy |
| **Stop Hook** | `verification-gate.ps1` | `verification_gate.py` | ACTIVE | Sửa schema `stop`/`continue` |

---

## 3. Danh Mục Các Script Legacy Lưu Trữ (Archived Scripts)

Các script PowerShell cũ được lưu giữ làm tài liệu tham khảo dự phòng (Read-Only Legacy Reference):

1. **`dispatcher.ps1`**:
   - Vai trò cũ: Wrapper phát hiện Python runtime và chuyển tiếp sự kiện PreToolUse.
   - Thay thế bởi: Cấu hình trực tiếp `python` trong `hooks.json`.
2. **`placeholder-guard.ps1`**:
   - Vai trò cũ: Quét các placeholder `TODO`, `FIXME`, `STUB_IMPLEMENTATION` bằng lệnh `Select-String`.
   - Thay thế bởi: `workspace_guard.py` (hàm `check_placeholders`).
3. **`diff-scope-guard.ps1`**:
   - Vai trò cũ: Kiểm tra đường dẫn tệp trong workspace bằng logic so sánh chuỗi PowerShell.
   - Thay thế bởi: `workspace_guard.py` (hàm `check_diff_scope`).
4. **`directory-structure-guard.ps1`**:
   - Vai trò cũ: Kiểm tra giới hạn độ sâu (Max Depth <= 2) và cross-screen import bằng PowerShell pipeline.
   - Thay thế bởi: `workspace_guard.py` (hàm `check_directory_governance`).
5. **`verification-gate.ps1`**:
   - Vai trò cũ: Thẩm định Stop Hook với logic `allow`/`deny`.
   - Thay thế bởi: `verification_gate.py` (hàm `evaluate_stop_gate` và `handle_stop`).

---

## 4. Bất Biến Kiến Trúc Bắt Buộc (Negative Scope Invariants)

- **INV-001 (Zero PowerShell)**: Tuyệt đối CẤM đưa bất kỳ lệnh gọi `powershell` nào trở lại `.agents/hooks.json`.
- **INV-004 (Strict Go Engine Schema)**: Sự kiện Stop chỉ được sử dụng `stop` hoặc `continue`, không dùng `allow` hoặc `deny`.
- **INV-005 (Relative Path Invariant)**: Đường dẫn lệnh trong `hooks.json` luôn bắt đầu bằng `python scripts/guards/...` với CWD mặc định là `.agents/`.
