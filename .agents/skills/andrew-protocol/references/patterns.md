# Operational Patterns: Feature, Bugfix & Refactor

Mỗi loại tác vụ mã nguồn bắt buộc tuân thủ quy trình kiểm chứng cơ học 3 bước (Pre -> Act -> Post):

---

## 1. Pattern: Triển Khai Tính Năng Mới (pattern_feature)

Quy trình TDD tối giản:
1. **Pre (Khẳng định Thất Bại)**:
   - Viết hoặc chỉ định Test Assertion khẳng định trạng thái Fail khi chưa có logic nghiệp vụ.
   - Chạy lệnh test -> Xác nhận Fail (Exit Code $\neq 0$).
2. **Act (Can Thiệp Tối Thiểu)**:
   - Viết khối mã phẫu thuật tối thiểu vừa đủ để thỏa mãn assertion.
   - Không viết thêm logic dự phòng.
3. **Post (Khẳng định Thành Công)**:
   - Chạy lại Test Assertion -> Xác nhận Pass (Exit Code 0).

---

## 2. Pattern: Sửa Lỗi Hệ Thống (pattern_bugfix)

Quy trình cô lập lỗi:
1. **Pre (Tái Hiện Lỗi)**:
   - Xây dựng Reproduction Test cô lập chính xác hành vi gây lỗi.
   - Chạy Reproduction Test -> Bắt buộc Fail (Exit Code $\neq 0$).
2. **Act (Phẫu Thuật Điểm Gãy)**:
   - Can thiệp phẫu thuật tại đúng vị trí gây lỗi mà không làm biến dạng các nhánh lân cận.
3. **Post (Bảo Toàn Hồi Quy)**:
   - Chạy Reproduction Test -> Chuyển sang Pass (Exit Code 0).
   - Chạy toàn bộ Regression Test Suite hiện hữu -> 100% giữ nguyên trạng thái Pass.

---

## 3. Pattern: Tái Cấu Trúc Mã Nguồn (pattern_refactor)

Quy trình bảo toàn ngữ nghĩa (Semantics-Preserving):
1. **Pre (Xác Lập Baseline)**:
   - Chạy toàn bộ Regression Test Suite hiện hữu -> Xác nhận Pass 100% trước khi chạm vào mã nguồn.
2. **Act (Tái Cấu Trúc Đẳng Cự)**:
   - Tái cấu trúc mã nguồn nhằm giảm Cyclomatic Complexity hoặc tối ưu cấu trúc.
   - Không được thay đổi hành vi nghiệp vụ hay interface công khai.
3. **Post (Kiểm Chứng Tương Đương)**:
   - Chạy lại Regression Test Suite -> Pass 100% mà KHÔNG PHẢI THAY ĐỔI bất kỳ test assertion nào.

