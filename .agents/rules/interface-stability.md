---
trigger: model_decision
description: "Sử dụng khi thay đổi các public API signatures, exported functions/classes, data contracts hoặc boundary layers của hệ thống."
---

# Tiêu Chuẩn Ổn Định Giao Diện (Interface Stability Boundary)

Bảo toàn tính nhất quán của interface contract, trạng thái hệ thống và độ tin cậy của downstream consumers:

## 1. Ranh Giới Chữ Ký Hàm Công Khai (Public Signatures)
- Các thay đổi mã nguồn **không được phép phá vỡ** chữ ký hàm (Function Signatures), kiểu dữ liệu trả về, hoặc tham số công khai đang được sử dụng bởi các module khác.
- Mọi thay đổi signature công khai bắt buộc phải được người dùng hoặc tài liệu đặc tả phê duyệt minh thị trước khi thực hiện.

## 2. Tiêu Chuẩn Lan Truyền Lỗi (Error Propagation Standard)
- **Triết lý Fail-Fast**: Lỗi phát sinh phải được bộc lộ rõ ràng thay vì âm thầm xử lý che giấu khiếm khuyết hệ thống (Silent Error Swallowing).
- **Ranh giới bắt ngoại lệ**: Chỉ bắt ngoại lệ tại tầng biên (Edge/Boundary Layer) có khả năng phục hồi hoặc ghi nhận log truy vết.
- CẤM các khối `catch (e) {}` rỗng hoặc `except: pass` không rethrow và không ghi log.

## 3. Quyết Định Kiến Trúc Type 1 vs Type 2
- **Type 1 (One-Way Door - Bất khả nghịch)**: Thay đổi cấu trúc cơ sở dữ liệu cốt lõi, thay đổi public API contract, đổi kiến trúc thư viện nền. 👉 **BẮT BUỘC DỪNG LẠI và xin phê duyệt trước khi code**.
- **Type 2 (Two-Way Door - Khả nghịch)**: Tối ưu logic nội bộ, sửa bug trong hàm cục bộ, bổ sung test case. 👉 Tự chủ giải quyết và kiểm chứng bằng test tự động.

