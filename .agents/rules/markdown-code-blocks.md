---
trigger: model_decision
description: "Quy chuẩn kỹ thuật bắt buộc khi định dạng các khối mã nguồn (Code Blocks) trong Markdown: bắt buộc gắn nhãn ngôn ngữ (Language Identifier) cho mọi khối mã mở đầu."
---

# Quy Chuẩn Định Dạng Khối Mã Nguồn (Code Blocks - C-STRUCT-03)

Quy định kỹ thuật bắt buộc áp dụng cho mọi phản hồi kỹ thuật, tài liệu đặc tả và báo cáo bàn giao:

## 1. Nguyên Tắc Bất Biến Về Khối Mã Mở Đầu (Opening Fence Invariance)
- **Bắt buộc định danh ngôn ngữ**: Mọi khối mã bắt đầu bằng ba dấu backtick (```` ``` ````) **BẮT BUỘC** phải có ngay mã định danh ngôn ngữ (language tag) chuẩn mực.
- **Ranh giới cấm tuyệt đối**: CẤM viết khối mã mở đầu trần trụi (bare fence) không có ngôn ngữ (ví dụ: cấm ```` ``` ```` đứng đơn độc ở dòng mở).

## 2. Bảng Danh Mục Language Identifiers Chuẩn Hóa
Khi tạo khối mã, chỉ sử dụng các định danh chuẩn xác sau:

| Ngôn Ngữ / Cấu Trúc | Thẻ Bắt Buộc | Ví Dụ Ứng Dụng |
| :--- | :--- | :--- |
| **PowerShell** | `powershell` | Các lệnh cmdlet, script `.ps1` |
| **Bash / Shell** | `bash` | Lệnh terminal Unix, curl, git |
| **JSON** | `json` | Cấu hình, payload API, `hooks.json` |
| **YAML** | `yaml` | Cấu hình, frontmatter, manifest |
| **XML** | `xml` | Đóng neo ngữ cảnh, data anchor |
| **Mermaid** | `mermaid` | Sơ đồ luồng, sequence, class diagram |
| **TypeScript / JS** | `typescript` / `javascript` | Mã ứng dụng front-end / back-end |
| **Python** | `python` | Script phân tích, kiểm thử |

## 3. Quy Cách Dấu Đóng Khối Mã (Closing Fence)
- Dấu đóng khối mã kết thúc bằng ba dấu backtick (```` ``` ````) đứng riêng biệt trên một dòng mới.
- Tuyệt đối không lồng ghép các khối mã sai cú pháp gây vỡ khung hiển thị của Markdown renderer.

