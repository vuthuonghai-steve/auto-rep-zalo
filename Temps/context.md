
   📑 Báo Cáo Bóc Tách Chuyên Sâu: Kiến Trúc Định Dạng Tài Liệu AI-First & Blueprint Xây Dựng Doc Formatter Skill

  Đã hoàn tất quá trình rà soát, đọc và bóc tách chuyên sâu 4 tài liệu nền tảng:

  • ~/Documents/workspace/Steves/Docs/AI-LLM/Knowleages/Standards.md
  • ~/Documents/workspace/Steves/Docs/Steve/Formats/synthesis-llm-principles.md
  • ~/Documents/workspace/Steves/Pluggins/prompt-deep-architect-plugin/skills/ai-first-prompt-formatter/README.md
  • ~/Documents/workspace/Steves/Pluggins/prompt-deep-architect-plugin/skills/ai-first-prompt-formatter/SKILL.md

  Dưới đây là nội dung bóc tách đa tầng tri thức, hướng dẫn cấu trúc định dạng lai (Hybrid Format) tối ưu cho LLM đọc chính xác tuyệt đối nhưng Con
  người vẫn đọc hiểu trực quan, cùng bản thiết kế chi tiết để xây dựng Agent Skill chuyên trách Format Tài Liệu.
  ──────

## PHẦN 1: BÓC TÁCH & PHÂN TẦNG TRI THỨC (KNOWLEDGE LAYERING)

  Các tài liệu trên xác lập một mô hình tri thức đa tầng từ bản chất nhận thức của LLM đến tiêu chuẩn kiến trúc tài liệu:

┌────────────────────────────────────────────────┐
│                                                │
│   Tầng Nhận Thức LLM (Cognitive Foundation)    │
│                                                │
│           - Vector Space Triggering            │
│                                                │
│           - 4 Tín hiệu tư duy S1-S4            │
│                                                │
│            - Dual Context Ingestion            │
│                                                │
└────────────────────────┬───────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────┐
│                                                │
│  Tầng Tiêu Chuẩn Toàn Cục (System Standards)   │
│                                                │
│             - Bộ ba AI-First Triad             │
│                                                │
│               - Giải phẫu 6 phần               │
│                                                │
│             - 4 Lớp tri thức L0-L3             │
│                                                │
│            - 5 Document Archetypes             │
│                                                │
└────────────────────────┬───────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────┐
│                                                │
│    Tầng Vận Hành Công Cụ (Execution Skill)     │
│                                                │
│          - Quy trình 4 bước đóng gói           │
│                                                │
│ - Cổng kiểm định cơ học nhị phân (Exit Code 0) │
│                                                │
└────────────────────────────────────────────────┘

### 1. Bản Chất Nhận Thức LLM: Vector Space Triggering & Semantic Anchors

  • Cơ chế kích hoạt không gian vector: LLM không phân tích tài liệu theo logic tuyến tính hay AST như trình biên dịch, mà dựa trên sự kích hoạt các
  vùng trọng số trong không gian vector đa chiều. Các mỏ neo vector ngôn ngữ (Linguistic Vector Anchors) là chìa khóa để "đánh thức" đúng miền tri
  thức chuyên sâu (Deep Knowledge).
  • Khoảng trống ngữ nghĩa (Semantic Void): Khi tài liệu thiếu mỏ neo hoặc chỉ nêu yêu cầu chung chung, cơ chế Attention sẽ tự động suy diễn theo xác
  suất từ ngữ phổ thông, dẫn tới sinh mã giả lập (Mock/Stub) hoặc chệch hướng nghiệp vụ.
  • Mỏ neo thuật ngữ (Domain Glossary ≥ 10 terms): Việc khai báo rõ ràng các thuật ngữ chuyên ngành (ví dụ: Idempotency-Key, HMAC-SHA256, Blast Radius,  
  AST Invariance) giúp kéo toàn bộ vector nhận thức về đúng không gian kỹ thuật bảo vệ trước khi LLM thực thi.

### 2. Lý Thuyết Độ Trễ Tư Duy (Thought Latency) & 4 Tín Hiệu S1–S4

  Độ sâu tư duy không đo bằng độ dài văn bản (Word Count Padding) mà đo bằng 4 Tín Hiệu Chiều Sâu Nhận Thức:

  • S1 (Negation Density - Ranh giới cấm): Kích hoạt không gian phủ định — mô hình hóa những điều hệ thống tuyệt đối KHÔNG ĐƯỢC LÀM (must_not).
  • S2 (Reverse Probing - Phòng vệ nghịch đảo): Kích hoạt không gian tự vệ — dự phóng các tình huống xấu nhất: crash, race condition, data corruption
  và kịch bản Rollback.
  • S3 (Multi-Stakeholder - Đa góc nhìn): Đánh giá tác động 4 chiều: Dev bảo trì, Vận hành (Ops), Người dùng cuối và An toàn bảo mật.
  • S4 (Constraint Anchoring - Ràng buộc vật lý): Neo chặt vào giới hạn phần cứng thực tế: RAM, CPU, I/O, Call Stack, Time Budget, không giả định môi
  trường vô hạn.

### 3. Mô Hình Phân Lớp Tri Thức 4 Tầng (L0 - L3)

  Tri thức được chia theo vòng đời và mức độ thiết yếu để kiểm soát dung lượng bộ nhớ (Context Window):

  • L0 - Hiến Pháp & Bản Sắc (Constitutional Rules): Bất biến cốt lõi, quy tắc an toàn sống còn → Nạp thường trực trong System Prompt (Always Active).
  • L1 - Chính Sách Vận Hành (Working Policies & Standards): Tiêu chuẩn viết code, quy tắc review → Nạp theo phạm vi module/sprint.
  • L2 - Kiến Trúc & Thiết Kế Miền (Domain & Architecture): ADR, Data Models, Data Flows → Nạp On-Demand qua Clickable Relative Links.
  • L3 - Bối Cảnh Tác Vụ Cụ Thể (Task Specs & Fixtures): Ticket, logs, test data → Bọc thẻ XML cô lập, tự giải phóng sau khi hoàn thành task.
  ──────

## PHẦN 2: HƯỚNG DẪN CẤU TRÚC TÀI LIỆU SONG HÀNH (HUMAN - LLM SYMBIOSIS)

  Mục tiêu cốt lõi: LLM xử lý với độ chính xác cơ học tuyệt đối, đồng thời Con người vẫn đọc hiểu trực quan, thoải mái.

┌─────────────────────────────────┐
│         Tối Ưu Cho LLM          │
│                                 │
│                                 │
│ ┌─────────────────────────────┐ │ ┌─────────────┐
│ │                             │ │ │             │
│ │   AB["Attention Budgeting   │ │ │             │
│ │                             │ ├►│  LLM_Focus  │
│ │             (Đầu            │ │ │             │
│ │                             │ │ │             │
│ └─────────────────────────────┘ │ └─────────────┘
│                                 │
│                                 │
│ ┌─────────────────────────────┐ │ ┌─────────────┐
│ │                             │ │ │             │
│ │    Cuối tập trung cao)"]    │ │ │ Human_Focus │
│ │                             │ │ │             │
│ └─────────────────────────────┘ │ └─────────────┘
│                                 │        ▲
│                                 │        │
│ ┌─────────────────────────────┐ │        │
│ │                             │ │        │
│ │    Chống Prompt Injection   │ │        │
│ │                             │ │        │
│ │    (XML Macro Delimiters)   │ │        │
│ │                             │ │        │
│ └─────────────────────────────┘ │        │
│                                 │        │
│                                 │        │
│ ┌─────────────────────────────┐ │        │
│ │                             │ │        │
│ │       Khóa Luật Cơ Học      │ │        │
│ │                             │ │        │
│ │      (YAML Constraints)     │ │        │
│ │                             │ │        │
│ └─────────────────────────────┘ │        │
│                                 │        │
└─────────────────────────────────┤        │
  ┌─────────────────────────────┐ │        │
┌─┼─────────────────────────────┼─┤        │
│ │   TrựcPQuanCChoTCon Người   │ │        │
│ │                             │ │        │
│ │    (Markdown Typography)    │ │        │
│ │                             │ │        │
│ └─────────────────────────────┘ │        │
│                                 │        │
│                                 │        │
│ ┌─────────────────────────────┐ │        │
│ │                             │ │        │
│ │     GitHub-style Alerts     │ │        │
│ │                             │ │        │
│ │  ([!NOTE], [!WARNING], ...) │ │        │
│ │                             │ │        │
│ └─────────────────────────────┘ │        │
│                                 │        │
│                                 │        │
│ ┌─────────────────────────────┐ │        │
│ │                             │ │        │
│ │     MMD["Biểu Đồ Mermaid    │ │        │
│ │                             │ │        │
│ └─────────────────────────────┘ │        │
│                                 │        │
│                                 │        │
│ ┌─────────────────────────────┐ │        │
│ │                             │ │        │
│ │             Diff            │ │        │
│ │                             │ │        │
│ │     (Lưu đồ trực quan)"]    │ │        │
│ │                             │ │        │
│ └─────────────────────────────┘ │        │
│                                 │        │
│                                 │        │
│ ┌─────────────────────────────┐ │        │
│ │                             │ │        │
│ │   Clickable Relative Links  │ │        │
│ │                             │ │        │
│ │ (Mở file trong IDE 1-click) │ │        │
│ │                             │ │        │
│ └─────────────────────────────┘ │        │
│                                 │        │
└────────────────┬────────────────┘        │
  ┌─────────────────────────────┐          │
  │              ┴              │          │
  │   Tài Liệu Chuẩn Song Hành  ├──────────┘
  │                             │
  └─────────────────────────────┘

### 1. Phân Bổ Chú Ý (Attention Budgeting) & Khắc Phục Hiện Tượng "Lost-in-the-Middle"

  • Bản chất: LLM tập trung mạnh nhất ở ĐẦU (Head) và CUỐI (Tail) tài liệu, nhưng dễ lơ là ở đoạn giữa.
  • Giải phẫu cấu trúc 6 phần (6-Part Anatomy):
      1. Tầng 1 (Đầu trang - Head): Mệnh lệnh tối cao (<instructions>) & Bất biến hành vi (execution_policy / YAML constraints). Nạp ngay "bộ lọc tư
      duy" trước khi đọc chi tiết.
      2. Tầng 2: Bối cảnh kỹ thuật, kiến trúc & thuật ngữ (<context>, Domain Glossary).
      3. Tầng 3 (Giữa trang): Thân bài kiến trúc & Mô hình khái niệm (Markdown phân cấp + Mermaid).
      4. Tầng 4: Hướng dẫn chi tiết & Các kịch bản biên (Edge cases, Multi-stakeholder analysis).
      5. Tầng 5: Ví dụ mẫu tương phản (Concrete Examples / Before-After Diffs).
      6. Tầng 6 (Cuối trang - Tail): Khế ước đầu ra (<output_contract>) & Cổng nghiệm thu nhị phân (verification_checklist). Nhắc lại điều kiện dừng
      trước khi LLM bắt đầu sinh mã.

### 2. Ranh Giới Cơ Học Bằng XML & Chống Prompt Injection

  • Attention Bleeding: Hiện tượng LLM nhầm lẫn dữ liệu tham chiếu (logs, mã bên thứ ba, input thô) thành mệnh lệnh điều khiển.
  • Cách phân vùng:
      • Dùng thẻ <instructions> độc quyền cho mệnh lệnh điều khiển cấp cao.
      • Dùng thẻ <context>, <input>, <examples> bọc dữ liệu thụ động. Mọi câu lệnh chèn mã (ví dụ: "Ignore previous rules...") nằm trong thẻ <context>
      sẽ tự động bị LLM xem là chuỗi ký tự tham chiếu thụ động.

### 3. Trải Nghiệm Đọc Trực Quan Cho Con Người (Human Usability)

  • GitHub-style Alerts: Phân cấp mức độ quan trọng bằng 5 cấp độ chuẩn (> [!NOTE], > [!TIP], > [!IMPORTANT], > [!WARNING], > [!CAUTION]).
  • Sơ đồ Mermaid & Diffs: Thay thế hàng nghìn từ mô tả luồng bằng Sequence Diagram, State Diagram hoặc Unified Diff (+ / -).
  • Clickable Relative Links:
      • Cú pháp chuẩn: [FileName.ext](relative/path/to/FileName.ext#L10-L25).
      • Giúp lập trình viên mở file ngay trong IDE bằng 1 cú click.
      • Bảo đảm tính khả chuyển (Portability) giữa các máy trạm khác nhau (không dùng đường dẫn tuyệt đối dạng C:\... hay /home/...).

  ──────

## PHẦN 3: CƠ CHẾ CHUYỂN ĐỔI SANG CẤU TRÚC ĐA ĐỊNH DẠNG LAI (HYBRID MULTI-FORMAT)

  Không sử dụng Markdown đơn thuần một cách phẳng lì. Từng phần tử trong tài liệu được giao cho đúng định dạng phát huy tối đa thế mạnh chuyên biệt:

### 1. Phân Công Năng Lực Chuyên Biệt (Format Capabilities)

   Định Dạng          │ Năng Lực Chuyên Biệt                     │ Đối Tượng Nhắm Tới                     │ Vị Trí Sử Dụng Chuẩn
  ────────────────────┼──────────────────────────────────────────┼────────────────────────────────────────┼───────────────────────────────────────────
   XML Macro Tags     │ Tạo ranh giới cô lập tuyệt đối, định vị  │ Tokenizer & Attention Mask của LLM     │ Khung bao vĩ mô: <instructions>,
                      │ vai trò khối, chống Attention Bleeding & │                                        │ <context>, <output_contract>. (CẤM bọc
                      │ Injection.                               │                                        │ thẻ vụn vặt quanh từng câu/dòng).
   YAML Blocks        │ Mô hình hóa kiểu dữ liệu chặt chẽ        │ Khối suy luận logic & Bộ phân tích máy │ Khai báo must, must_not, priority_order,
                      │ (Strict typing), khóa danh sách luật     │                                        │ criteria.
                      │ cứng, độ sâu ≤ 3.                        │                                        │
   Markdown Narrative │ Cung cấp luồng đọc tự nhiên, tiêu đề     │ Đọc hiểu thị giác của Con người & AI   │ Thân bài kiến trúc, giải thích nguyên lý
                      │ phân cấp rõ ràng (H1–H4), bảng biểu so   │                                        │ (Rationale), bảng tham số.
                      │ sánh.                                    │                                        │
   Mermaid Diagrams   │ Trực quan hóa cấu trúc nhánh, chu trình, │ Não bộ con người & Khả năng quan hệ đồ │ Sơ đồ luồng dữ liệu, lifecycle, tương tác
                      │ FSM (máy trạng thái), sequence tương     │ thị của AI                             │ đa tác tử.
                      │ tác.                                     │                                        │
   JSON / Code Diffs  │ Cung cấp schema xác thực cơ học và hiển  │ Test runner & IDE Diff Viewer          │ Schema dữ liệu, hợp đồng API, khối diff
                      │ thị biến đổi mã nguồn trước/sau.         │                                        │ trực quan.

### 2. Thuật Toán 6 Bước Chuyển Đổi (Flat Markdown → Hybrid AI-First)

  │ Diagram exceeds terminal width (223 > 152 cols)
  │ Displayed as code block. Widen terminal to view inline.

    flowchart TD
        Flat["Tài Liệu Markdown Phẳng (Flat Markdown)"] --> Step1["Bước 1: Bóc Tách Mệnh Lệnh & Luật Cứng\n(Tìm từ khóa: phải, cấm, ưu tiên, bắt
        buộc)"]
        Step1 --> Step2["Bước 2: Chuyển Luật Cứng Thành Schema YAML\n(Tạo khối constraints: must, must_not, priority_order)"]
        Step2 --> Step3["Bước 3: Bọc Khung Macro XML Cho Các Phân Vùng\n(<instructions>, <context>, <output_contract>)"]
        Step3 --> Step4["Bước 4: Tái Sắp Xếp Theo Giải Phẫu 6 Phần\n(Instructions lên đầu, Output Contract xuống cuối)"]
        Step4 --> Step5["Bước 5: Chuyển Luồng Mô Tả Thành Mermaid / Bảng\n(Trực quan hóa state transition, sequence flow)"]
        Step5 --> Step6["Bước 6: Khử 6 Mùi Thiết Kế & Chuẩn Hóa Links\n(YAML depth <= 3, Clickable relative links, GitHub Alerts)"]
        Step6 --> Output["Tài Liệu Chuẩn AI-First Hoàn Chỉnh"]

### 3. Ma Trận Khử 6 Mùi Thiết Kế Xấu (Anti-Patterns Remediation)

    anti_patterns_remediation:
      1_flat_markdown_sprawl:
        symptom: "Văn bản dằng dặc toàn chữ, luật kỹ thuật quan trọng bị chìm nghỉm."
        solution: "Trích xuất luật cứng vào khối YAML constraints; chuyển văn xuôi mô tả luồng thành Mermaid."

      2_micro_tagging_noise:
        symptom: "Lạm dụng thẻ XML bọc quanh từng dòng, từng cụm từ làm phân mảnh token."
        solution: "Xóa toàn bộ micro-tags; chỉ giữ lại 3-4 cặp thẻ macro phân tách khối lớn."

      3_deep_schema_nesting:
        symptom: "YAML lồng nhau 4 đến 6 cấp thụt lề làm trôi ngữ cảnh thuộc tính."
        solution: "Phẳng hóa cấu trúc; giới hạn độ sâu lồng nhau tối đa 3 cấp (<= 6 spaces)."

      4_broken_or_absolute_links:
        symptom: "Đường dẫn tuyệt đối máy trạm (C:\\...) hoặc bọc backtick quanh link ([`file.ts`](...))."
        solution: "Chuyển thành liên kết tương đối chuẩn Markdown: [file.ts](path/to/file.ts)."

      5_context_dilution_monolith:
        symptom: "Dồn toàn bộ hướng dẫn, specs, logs, test data vào duy nhất 1 tệp khổng lồ."
        solution: "Tách theo mô hình 4 tầng L0-L3; lưu tài liệu con và liên kết On-Demand."

      6_missing_negative_space:
        symptom: "Tài liệu chỉ nói những gì cần làm, thiếu hoàn toàn danh mục điều cấm."
        solution: "Bắt buộc bổ sung tối thiểu 3 điều cấm cụ thể (must_not) kèm hậu quả khi vi phạm."
  ──────

## PHẦN 4: BLUEPRINT & KHUNG THIẾT KẾ BỘ "DOC FORMATTER SKILL"

  Dưới đây là bản thiết kế kiến trúc chuẩn để triển khai bộ Agent Skill chuyên trách định dạng tài liệu (ai-first-doc-formatter).

### 1. Thông Tin & Vị Trí Vận Hành

  • Tên Skill: ai-first-doc-formatter (hoặc ai-first-document-architect)
  • Vai trò: Formatting Middleware & Mechanical Quality Gatekeeper.
  • Đầu vào: Mọi tài liệu kỹ thuật dạng thô (Draft PRD, Architecture Spec, Coding Standards, Task Ticket, Prompt).
  • Đầu ra: Tài liệu cấu trúc đa định dạng lai (Hybrid Triad), vượt qua 100% kiểm định cơ học Exit Code 0.

### 2. Cấu Trúc Thư Mục Skill Đề Xuất

    .agents/skills/ai-first-doc-formatter/
    ├── SKILL.md                                 # File điều hướng trung tâm: Boot sequence, Hard Invariants, Routing
    ├── README.md                                # Hướng dẫn tổng quan và triết lý vận hành
    ├── references/                              # Tri thức chuyên sâu nạp On-Demand
    │   ├── ai-first-triad-principles.md         # Nguyên lý phối hợp XML + YAML + Markdown
    │   ├── document-archetypes-guide.md         # Chi tiết 5 Archetypes tài liệu chuẩn
    │   ├── thought-latency-and-anchors.md       # Cơ chế mỏ neo vector & 4 tín hiệu tư duy S1-S4
    │   └── formatting-anti-patterns.md          # 6 mùi thiết kế xấu & giải pháp khử mùi
    ├── templates/                               # Biểu mẫu cấu trúc chuẩn cho 5 Archetypes
    │   ├── archetype-1-constitutional.template.md # Mẫu AGENTS.md, SYSTEM_PROMPT.md
    │   ├── archetype-2-operational-policy.template.md # Mẫu coding_standards, review_checklist
    │   ├── archetype-3-task-specification.template.md # Mẫu task_spec.md, sprint_ticket
    │   ├── archetype-4-architecture-adr.template.md   # Mẫu ADR, domain mental models
    │   └── archetype-5-skill-playbook.template.md     # Mẫu SKILL.md chuyên biệt
    ├── schemas/                                 # Schema kiểm định hình thức
    │   ├── ai-first-document-schema.json        # Schema kiểm tra cấu trúc vĩ mô tài liệu
    │   └── yaml-constraints-schema.json         # Schema kiểm tra tính hợp lệ của khối YAML
    ├── scripts/                                 # Công cụ tự động hóa kiểm tra cơ học
    │   ├── verify-ai-first-format.py            # Script Python kiểm định nhị phân (Exit Code 0/1)
    │   └── auto-format-markdown.py              # Script tự động trích xuất và bọc khung sơ bộ
    └── examples/                                # Cặp đối chứng Before / After thực tế
        ├── 01-flat-to-hybrid-adr.example.md     # Chuyển đổi ADR từ flat sang hybrid
        └── 02-task-spec-packaging.example.md    # Chuyển đổi task ticket sang Archetype 3

### 3. Khung Cổng Kiểm Định Nhị Phân (Binary Quality Gate) Cho Skill

  Tài liệu sau khi được Skill format chỉ được phép bàn giao khi vượt qua 5 cổng kiểm tra cơ học (Exit Code 0):

    binary_quality_gate:
      gate_1_macro_delimiters:
        criteria: "Tồn tại tối thiểu 2 thẻ XML vĩ mô (<instructions>, <context>, <output_contract>) và toàn bộ thẻ được đóng mở cân bằng 100%."
        check_type: "Mechanical (Script Exit Code 0)"

      gate_2_yaml_resilience:
        criteria: "100% khối ```yaml parse thành công qua yaml.safe_load() và độ sâu lồng nhau <= 3 cấp."
        check_type: "Mechanical (Script Exit Code 0)"

      gate_3_link_portability:
        criteria: "100% liên kết tệp là đường dẫn tương đối click được dạng [Tên](đường/dẫn); không chứa backtick trong link và không hardcode đường     
        dẫn tuyệt đối cục bộ."
        check_type: "Mechanical (Script Exit Code 0)"

      gate_4_negative_space_declared:
        criteria: "Tài liệu bắt buộc chứa danh mục must_not hoặc forbidden_patterns với tối thiểu 3 điều cấm kèm hậu quả kỹ thuật."
        check_type: "Boolean Rule Check"

      gate_5_anti_micro_tagging:
        criteria: "Số lượng thẻ XML phân biệt <= 12 thẻ (chống ô nhiễm vi mô tokenizer)."
        check_type: "Mechanical (Script Exit Code 0)"
