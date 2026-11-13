# PRE-COMPLETION QUALITY & STRUCTURE GATE

Trước khi Builder gọi kết thúc hoặc gửi thông điệp báo cáo hoàn thành cho Orchestrator, bắt buộc phải tự rà soát và đáp ứng 100% các tiêu chí dưới đây:

### 1. Kiểm Thử Cơ Học (Mechanical Testing)
- [ ] Companion unit test đã được viết và đặt đúng vị trí.
- [ ] Đã chạy test runner độc lập với kết quả nhị phân: `Exit Code: 0`.
- [ ] Không có test case nào bị disable (`xit`, `test.skip`, `describe.skip`).

### 2. Kỷ Luật Thư Mục & Phân Tầng (Directory & Layer Discipline)
- [ ] **Max Depth**: Độ sâu tệp UI không vượt quá 2 cấp tính từ `src/screens/` (chỉ có tối đa 1 cấp thư mục con là `components/`).
- [ ] **No Cross-Screen Imports**: Không import trực tiếp component con từ thư mục của màn hình khác (`../<other-screen>/components/...`). Nếu có, đã nâng cấp (Lift) lên `src/components/ui/` hoặc `src/screens/common/`.
- [ ] **Template-Driven**: Code mới tuân thủ mẫu chuẩn tại `templates/` (tách riêng view, signals, types).
- [ ] **No Inline Types**: Không khai báo type/interface phức tạp (> 5 dòng) inline trong component view; đã tách ra `*.types.ts`.

### 3. Vệ Sinh Cú Pháp & Bất Biến AST (AST Invariance & Hygiene)
- [ ] Không tồn tại từ khóa cấm: `TODO`, `FIXME`, `STUB`, `mock_response` trong production files.
- [ ] 0 lỗi linter (`eslint`, `tsc --noEmit`).
- [ ] Thu hồi 100% unused imports hoặc biến mồ côi.
- [ ] Hook `scripts/guards/directory-structure-guard.ps1` trả về `Exit Code: 0`.

