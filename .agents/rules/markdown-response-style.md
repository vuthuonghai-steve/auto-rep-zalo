---
trigger: model_decision
description: "Quy chuẩn chất lượng đầu ra, phong cách phản hồi và định dạng Markdown (Release Mode Output Standard): Chuẩn hóa kiến trúc lai XML Frame + YAML Payload cho giao tiếp hệ thống và Fenced Code Blocks cho mã thực thi."
---

# Quy Chuẩn Chất Lượng Đầu Ra & Định Dạng (Release Mode Output Standard)

```xml
<context_boundary>
phase_activation: "CHỈ KÍCH HOẠT TẠI BƯỚC BÀN GIAO CUỐI CÙNG (Pha P6 - Release Mode)"
raw_mode_protection: "TUYỆT ĐỐI KHÔNG ÁP DỤNG TRONG QUÁ TRÌNH SUY LUẬN (Thinking) HOẶC SCRATCH"
architecture_standard: "HYBRID_XML_FRAME_AND_YAML_PAYLOAD"
</context_boundary>
```

Tài liệu này xác lập quy chuẩn phân lập ranh giới ba tầng giữa **Siêu Dữ Liệu Cấp Tệp**, **Giao Tiếp Hệ Thống**, và **Mã Nguồn Bàn Giao**:

---

## 1. Phân Tầng Cấu Trúc Ba Lớp (Three-Tier Structural Standard)

| Tầng Cấu Trúc | Định Dạng Bắt Buộc | Ưu Thế Kỹ Thuật Đạt Được |
| :--- | :--- | :--- |
| **Tầng 1: Siêu dữ liệu cấp tệp (Root File Metadata)** | **YAML Frontmatter (`--- ... ---`)** ở đầu tệp | Tiết kiệm 35% token; CommonMark hỗ trợ bản địa; định danh tệp máy đọc được. |
| **Tầng 2: Giao tiếp hệ thống & Chốt chặn (System & Inter-Agent)** | **Khối Lai XML-YAML (`<tag> YAML </tag>`)** | Ranh giới phân tách rõ ràng (XML) + Cấu trúc phân cấp kiểu nghiêm ngặt (YAML). |
| **Tầng 3: Mã nguồn thực thi (Runnable Code)** | **Fenced Code Blocks (` ```powershell `, ` ```bash `)** | Đóng gói mã thực thi an toàn; bảo toàn syntax highlighting và nút copy. |

---

## 2. Ranh Giới Cấm Tuyệt Đối (Negative Space)
- CẤM viết YAML trần trụi ở giữa bài mà không có vỏ bọc XML (tránh lỗi sụp đổ thụt lề Markdown).
- CẤM lồng các thẻ XML con bên trong khối XML hệ thống nếu dữ liệu có thể biểu diễn bằng YAML key-value.
- CẤM viết mã thực thi trần ngoài khối code block có gắn nhãn ngôn ngữ.

---

## 3. Khả Năng Truy Vết Cơ Học (C-READ-04)
- 100% tệp tham chiếu phải dùng Markdown link clickable: `[basename](file:///path#Lxx-Lyy)`.
