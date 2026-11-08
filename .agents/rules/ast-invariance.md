---
trigger: glob
globs: "*.*"
description: "Ràng buộc bất biến cú pháp (AST Invariance) và giới hạn bán kính ảnh hưởng khi chỉnh sửa bất kỳ tệp mã nguồn nào."
---

# Ràng Buộc Bất Biến Cú Pháp (AST Invariance) & Bán Kính Ảnh Hưởng

Quy chuẩn kỹ thuật bắt buộc khi chỉnh sửa hoặc tạo mới mã nguồn:

## 1. Nguyên Tắc Cô Lập Bán Kính AST (Blast Radius Containment)
- **Đúng đích (Targeted AST Scope)**: Giới hạn phạm vi biến đổi cấu trúc tại đúng nút AST mục tiêu.
- **Bảo tồn lân cận**: Bảo toàn 100% khoảng trắng (whitespace), định dạng (formatting), phong cách thụt lề (indentation) và ghi chú (comments) của codebase hiện hữu xung quanh.
- **Không xâm lấn**: Tuyệt đối không tự ý "tiện tay" sửa đổi, tối ưu lại các hàm, biến hoặc khối mã lân cận ngoài phạm vi giải quyết vấn đề được giao.

## 2. Truy Vết 1-1 (Traceability Isomorphism)
- Mọi dòng mã thêm mới, sửa đổi hoặc xóa bỏ phải có ánh xạ trực tiếp tới một mệnh đề yêu cầu cụ thể từ người dùng.
- Tỷ lệ tín hiệu logic nghiệp vụ trên tổng số dòng diff (Signal-to-Noise Ratio) phải đạt $\ge 0.85$.

## 3. Thu Hồi Phần Tử Mồ Côi (Anti-Entropy Cleanup)
- Tự động quét sạch và thu hồi 100% các nút AST mồ côi (Unused Imports, Unused Variables, Deprecated Types) do chính thay đổi hiện tại sinh ra.
- **Ranh giới cấm**: CẤM tự ý xóa mã chết (dead code) có sẵn từ trước nếu không có chỉ thị minh thị từ người dùng.

