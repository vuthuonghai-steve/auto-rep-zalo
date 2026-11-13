# 📐 AI-First Document Formatter — Triad Specification & Mechanical Packaging

## 1. Giới Thiệu Tổng Quan (Executive Overview)

`ai-first-doc-formatter` là kỹ năng chuẩn hóa và định dạng tài liệu kỹ thuật, khế ước tác vụ, và chính sách kiến trúc dành riêng cho Large Language Models (LLMs) và AI Coding Agents trong toàn bộ hệ sinh thái Google Antigravity 2.0.

Khác với tài liệu truyền thống vốn chỉ được tối ưu cho mắt người đọc lướt (chứa nhiều văn phong biểu cảm, giả định ngầm hiểu và văn bản phẳng thiếu phân cấp), tài liệu AI-First được thiết kế theo cấu trúc **Bộ Ba Tam Hợp (AI-First Triad)**:
- **Macro XML Envelope**: Phân định ranh giới ngữ nghĩa cứng giữa chỉ thị hành động (`<instructions>`), dữ liệu tham chiếu (`<context>`), và khế ước nghiệm thu (`<output_contract>`). Ngăn chặn triệt để hiện tượng Attention Bleeding và Prompt Injection.
- **Structured YAML Schema**: Khóa chặt các luật cứng, danh mục bất biến, thứ tự ưu tiên (`priority_order`), ràng buộc bắt buộc (`must`) và vùng cấm tuyệt đối (`must_not`) với độ sâu lồng nhau nghiêm ngặt $\le 3$ cấp.
- **Human-Readable Markdown & Diagrams**: Cung cấp bối cảnh kỹ thuật sâu, sơ đồ luồng Mermaid, bảng đối chiếu và GitHub Alerts cho kỹ sư con người thẩm định.

---

## 2. Cấu Trúc Thư Mục Tiêu Chuẩn (Blueprint Architecture)

```text
.agents/skills/ai-first-doc-formatter/
├── SKILL.md                                 # File điều hướng chính (Triad Protocol, Invariants, Routing Map)
├── README.md                                # Hướng dẫn tổng quan, kiến trúc và kiểm định cơ học
├── references/                              # Tài liệu chuyên sâu nạp on-demand
│   ├── ai-first-triad-principles.md         # Quy chuẩn kết hợp XML + YAML + Markdown
│   ├── document-archetypes-guide.md         # Hướng dẫn chi tiết 5 Document Archetypes chuẩn
│   ├── thought-latency-and-anchors.md       # Cơ chế độ trễ tư duy S1-S4 và semantic anchors
│   └── formatting-anti-patterns.md          # 6 mùi thiết kế tài liệu xấu và biện pháp xử lý
├── templates/                               # Biểu mẫu cấu trúc chuẩn cho 5 Archetypes
│   ├── archetype-1-constitutional.template.md      # Mẫu hiến pháp & điều hướng nhận thức L0
│   ├── archetype-2-operational-policy.template.md  # Mẫu chính sách vận hành & tiêu chuẩn code L1
│   ├── archetype-3-task-specification.template.md  # Mẫu đặc tả tác vụ kỹ thuật L3
│   ├── archetype-4-architecture-adr.template.md    # Mẫu quyết định kiến trúc & domain model L2
│   └── archetype-5-skill-playbook.template.md      # Mẫu playbook kỹ năng thao tác chuẩn L1/L2
├── schemas/                                 # Schema kiểm định hình thức
│   ├── ai-first-document-schema.json        # JSON Schema kiểm tra cấu trúc tài liệu AI-First
│   └── yaml-constraints-schema.json         # JSON Schema kiểm tra cấu trúc ràng buộc YAML
├── scripts/                                 # Công cụ tự động hóa kiểm tra cơ học
│   ├── verify-ai-first-format.py            # Script Python kiểm định cơ học nhị phân (Exit Code 0/1)
│   └── auto-format-markdown.py              # Script Python tự động bọc thẻ XML, chuẩn hóa link & format
└── examples/                                # Cặp đối chứng Before / After thực tế
    ├── 01-flat-to-hybrid-adr.example.md     # Chuyển đổi ADR phẳng thành AI-First Triad
    └── 02-task-spec-packaging.example.md    # Đóng gói task spec hoàn chỉnh vượt qua Gate 0
```

---

## 3. Hệ Thống 5 Document Archetypes

| Archetype | Tên Gọi | Lớp Tri Thức | Tệp Biểu Mẫu | Mục Đích Sử Dụng |
| :--- | :--- | :---: | :--- | :--- |
| **Archetype 1** | Constitutional Steering | **L0** | [archetype-1-constitutional.template.md](templates/archetype-1-constitutional.template.md) | Định vị bản sắc Agent, ranh giới bất biến, hiến pháp hệ thống |
| **Archetype 2** | Operational Policy | **L1** | [archetype-2-operational-policy.template.md](templates/archetype-2-operational-policy.template.md) | Tiêu chuẩn viết code, quy tắc review, an toàn thông tin |
| **Archetype 3** | Task Specification | **L3** | [archetype-3-task-specification.template.md](templates/archetype-3-task-specification.template.md) | Đặc tả ticket, công việc nguyên tử, tiêu chí nghiệm thu |
| **Archetype 4** | Architecture & ADR | **L2** | [archetype-4-architecture-adr.template.md](templates/archetype-4-architecture-adr.template.md) | Ghi nhận quyết định kiến trúc, sơ đồ luồng, ma trận đánh đổi |
| **Archetype 5** | Skill & Action Playbook | **L1/L2**| [archetype-5-skill-playbook.template.md](templates/archetype-5-skill-playbook.template.md) | Quy trình từng bước thực thi kỹ năng, xử lý lỗi, ranh giới nguy hiểm |

---

## 4. Công Cụ Kiểm Định & Tự Động Hóa (Tooling)

### 4.1. Kiểm Định Cơ Học Cú Pháp (Mechanical Verification Gate)
Kiểm tra tính hợp chuẩn của tài liệu bằng script [verify-ai-first-format.py](scripts/verify-ai-first-format.py):
```bash
python .agents/skills/ai-first-doc-formatter/scripts/verify-ai-first-format.py <duong_dan_file.md>
```
- **Exit Code 0**: Đạt chuẩn AI-First 100% (Balanced XML, YAML depth $\le 3$, Macro delimiters hợp lệ, Negative space $\ge 3$, No backtick links, No absolute local paths).
- **Exit Code 1**: Phát hiện lỗi cấu trúc và in báo cáo chi tiết để sửa đổi.

### 4.2. Tự Động Hóa Định Dạng (Auto-Formatting Tool)
Tự động chuyển đổi tài liệu phẳng Markdown hoặc bọc khung Macro Envelope thông qua [auto-format-markdown.py](scripts/auto-format-markdown.py):
```bash
python .agents/skills/ai-first-doc-formatter/scripts/auto-format-markdown.py <input.md> --output <output.md> --archetype 3
```

---

## 5. Quy Chuẩn Liên Kết & Di Động (Portability Rules)
1. **Clickable Relative Links**: Toàn bộ liên kết trong tài liệu bắt buộc dùng đường dẫn tương đối dạng `[Tên](duong/dan/tuong_doi.md)`.
2. **Cấm Backticks Trong Nhãn Link**: Tuyệt đối không dùng `[`file`](path)` vì làm hỏng parser Markdown.
3. **Cấm Hardcoded Absolute Paths**: Cấm nhúng đường dẫn cục bộ cá nhân (`C:\Users\...` hoặc `/home/...`) vào tài liệu chia sẻ chung.
