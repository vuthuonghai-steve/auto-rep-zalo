---
trigger: model_decision
description: "Quy chuẩn thích ứng mức độ hình thức và kiểm soát token ngân sách (Adaptive Ceremony & Token Budget - C-QUAL-01): Kết hợp tối ưu YAML Frontmatter cấp tệp và Direct XML cục bộ <= 3 cấp."
---

# Quy Chuẩn Thích Ứng Hình Thức & Kiểm Soát Token (Adaptive Ceremony - C-QUAL-01)

Quy chuẩn kỹ thuật bắt buộc nhằm triệt tiêu hiện tượng phình to token (Anti-Token Bloat) khi sử dụng định dạng Native Markup:

## 1. Phân Tầng Cấu Trúc Siêu Dữ Liệu (Metadata Tiering)

| Cấp Độ Siêu Dữ Liệu | Định Dạng Bắt Buộc | Ranh Giới Giới Hạn |
| :--- | :--- | :--- |
| **Cấp tài liệu toàn thể (Document-Level Root)** | **YAML Frontmatter (`--- ... ---`)** ở đầu tệp | Tiết kiệm 35% token so với XML lồng nhau; bảo toàn thuộc tính máy đọc |
| **Cấp sự kiện/ngữ cảnh cục bộ (In-Content Context)** | **Direct Native XML Tags** (`<context_anchor>`, `<task_status>`) | Giới hạn **độ sâu tối đa $\le 3$ cấp**; CẤM lồng XML quá sâu gây Token Bloat |
| **Mã nguồn thực thi (Runnable Code)** | **Fenced Code Blocks** (` ```powershell `, v.v.) | Bắt buộc có language identifier chuẩn |

## 2. Nguyên Tắc Phẳng Hóa Schema XML (Schema Flattening Principle)

- Không lồng các thẻ XML không cần thiết như `<root><wrapper><items><item><data>value</data></item></items></wrapper></root>`.
- Phẳng hóa cấu trúc để mỗi thẻ XML mang mật độ ngữ nghĩa cao nhất trên từng token:

  ```xml
  <task_checkpoint>
    <task_id>001</task_id>
    <status>COMPLETED</status>
    <exit_code>0</exit_code>
  </task_checkpoint>
  ```
