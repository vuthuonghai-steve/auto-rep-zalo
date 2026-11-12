---
trigger: model_decision
description: "Quy chuẩn truy vết cơ học và liên kết tệp khả dụng (Clickable File Links - C-QUAL-03 & C-READ-04): 100% đường dẫn tệp phải là markdown link chuẩn file:///."
---

# Quy Chuẩn Liên Kết Tệp Khả Dụng (Clickable File Links - C-READ-04 & C-QUAL-03)

Quy định kỹ thuật bắt buộc nhằm đảm bảo tính truy vết cơ học (Mechanical Traceability) tức thì:

## 1. Định Dạng Bắt Buộc Của Liên Kết Tệp
- Mọi lần đề cập hoặc viện dẫn tới tệp mã nguồn, tệp cấu hình hoặc tài liệu trong repository **BẮT BUỘC** phải sử dụng định dạng Markdown Link Clickable:
  ```markdown
  [basename](file:///absolute/path/to/file#L12-L34)
  ```
- **Quy tắc đường dẫn URL**:
  - Dùng tiền tố `file:///`.
  - Trên Windows, sử dụng dấu gạch chéo xuôi (`/`), ví dụ: `file:///C:/Users/ADMIN/...`.
  - Dùng `basename` làm anchor text để bảo đảm khả năng đọc tự nhiên.

## 2. Ranh Giới Cấm Tuyệt Đối (Negative Space)
- CẤM sử dụng đường dẫn văn bản trần trụi (ví dụ: `C:\path\to\file.js`).
- CẤM liên kết tới tệp không tồn tại (Dead Link / Phantom File). Mọi tệp dẫn link phải được kiểm chứng cơ học thực tế có trên ổ đĩa.
- CẤM dùng dấu gạch chéo ngược (`\`) bên trong `file:///`.
