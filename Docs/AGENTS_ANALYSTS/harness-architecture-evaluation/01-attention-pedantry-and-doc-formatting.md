<instructions>
```yaml
document_metadata:
  title: "Bóc Tách Tác Động Của Bắt Bẻ Cú Pháp Bề Mặt Lên Chất Lượng Tư Duy Và Định Vị Kiến Trúc Tác Giả - Biên Tập Viên"
  archetype: "archetype-4-architecture-adr"
  version: "1.1.0"
  status: "ACTIVE"
rules:
  - must_not: "CẤM ép buộc mô hình thực hiện đồng thời suy luận logic sâu và nắn chỉnh cú pháp vi mô trong cùng một bước sinh mã."
  - must_not: "CẤM ngộ nhận script Python có khả năng tự động biên tập ngữ nghĩa thay thế năng lực thinking của mô hình."
  - must_not: "CẤM để tài liệu nháp phi cấu trúc lưu hành làm chân lý SSOT gây ngộ độc ngữ cảnh trung gian cho các lượt chạy sau."
```
</instructions>

<context>

# BÓC TÁCH TÁC ĐỘNG CỦA CÚ PHÁP BỀ MẶT LÊN TƯ DUY & KIẾN TRÚC "TÁC GIẢ - BIÊN TẬP VIÊN" (AUTHOR - EDITOR PATTERN)

Tài liệu này giải quyết điểm nghẽn nhận thức: *Bắt bẻ cú pháp XML/YAML trong khi code làm suy giảm chất lượng tư duy ra sao? Tại sao Python không thể tự động biên tập ngữ nghĩa? Và làm thế nào để vừa bảo vệ Attention Budget của Builder vừa không làm ô nhiễm ngữ cảnh trung gian của hệ thống?*

---

## 1. Cơ Chế Thần Kinh Của LLM: Xung Đột Ngân Sách Chú Ý (Attention Budget Collision)

Trong kiến trúc Transformer, ngân sách chú ý (Attention Budget) và chuỗi token suy luận (Thinking Tokens) là tài nguyên hữu hạn được phân bổ tuần tự:

```mermaid
flowchart LR
    subgraph BudgetCollision["Xung Đột Ngân Sách Chú Ý Trong Lượt Sinh Mã"]
        direction TB
        TokenPool["Tổng Ngân Sách Tư Duy\n(CoT / Thinking Tokens)"]
        SyntaxFocus["50% Phân Bổ Cho Cú Pháp Bề Mặt -<br/>• Đếm khoảng trắng thụt lề YAML<br/>• So khớp thẻ đóng mở XML<br/>• Tránh backtick trong link Markdown"]
        LogicFocus["Còn Lại 50% Cho Logic Hệ Thống -<br/>• Bất biến kiến trúc & Call Graph<br/>• Kiểm thử biên & Khả năng hồi quy<br/>• An toàn kiểu dữ liệu & Runtime Crash"]
    end
    TokenPool --> SyntaxFocus
    TokenPool --> LogicFocus
```

### 1.1. Hiện tượng "Attention Bleeding" do Cú pháp Vi mô
Khi hệ thống áp đặt đồng thời quá nhiều ràng buộc định dạng bề mặt vào cùng một bước tạo mã:
- **Phân tán ma trận Self-Attention**: Các attention heads phải liên tục duy trì trạng thái đếm khoảng trắng ($\le 6$ spaces) và kiểm tra thẻ XML mở/đóng.
- **Hội chứng "Thiên lệch làm vừa lòng linter" (Linter Placation Bias)**: Mô hình ưu tiên sinh đầu ra vượt qua regex của Guard, dẫn đến việc cắt ngắn hoặc đơn giản hóa phần suy luận logic phức tạp.
- **Hậu quả thực tế trong phiên 5eebf587**: Agent sinh ra toàn bộ thẻ XML và YAML cực kỳ đẹp mắt, vượt qua 7 guard hình thức, nhưng lại **quên mất việc kiểm tra xem công cụ `call_mcp_tool` có tồn tại trong Go registry hay không**, dẫn đến sập toàn bộ hệ thống trong IDE.

---

## 2. Giới Hạn Của Script Máy: Tại Sao Python Không Thể Tự Biên Tập Ngữ Nghĩa?

Một sai lầm thiết kế phổ biến là kỳ vọng script Python (`auto-format-markdown.py`) có thể tự động "sửa ngầm" các tài liệu văn xuôi phi cấu trúc thành chuẩn AI-First Triad trên đĩa cứng:

```mermaid
flowchart TD
    subgraph PythonLimit["Giới Hạn Cơ Học Của Script Python"]
        PythonInput["Văn bản văn xuôi thô / nháp"] --> Script["Script Python (auto-format-markdown.py)"]
        Script --> BadResult["Chỉ ghép được template cứng nhắc placeholder rỗng:<br/>• task_id: TSK-AUTO<br/>• must_not: CẤM lồng YAML...<br/>=> MÙ NGỮ NGHĨA HOÀN TOÀN!"]
    end
```

### 2.1. Phân biệt rạch ròi hai bản chất công việc
1. **Kiểm tra / Sửa cú pháp máy (Syntactic Linting)**: Đếm khoảng trắng, sửa dấu ngoặc, chuẩn hóa link regex. Đây là việc **Python làm rất tốt** (nhanh, tốn ít CPU, tất định).
2. **Biên tập & Chưng cất cấu trúc ngữ nghĩa (Semantic Distillation)**:
   - Đọc hiểu nghiệp vụ để trích xuất **Bất biến kiến trúc (Invariants)**.
   - Phân tích rủi ro để thiết lập **Ranh giới phủ định (Negative Space - 3 điều `must_not`)**.
   - Vẽ sơ đồ **Mermaid Flowchart / Sequence** mô hình hóa luồng dữ liệu.
   - Nén mật độ thông tin, triệt tiêu văn phong kể lể dài dòng.
   - **Đây là CÔNG VIỆC TƯ DUY (Cognitive Work)**, bắt buộc phải sử dụng năng lực `Thinking` của mô hình thông qua một Skill chuyên trách như `ai-first-doc-formatter`.

---

## 3. Kiến Trúc Hợp Nhất: Mô Hình "Tác Giả - Biên Tập Viên" (The Author - Editor Pattern)

Để vừa bảo phóng thích 100% Attention cho Builder khi viết code, vừa đảm bảo tài liệu lưu lại trên đĩa cứng đạt độ nén ngữ nghĩa cao và không làm ngộ độc context trung gian của các turn kế tiếp:

```mermaid
sequenceDiagram
    autonumber
    actor User as Người Dùng / Orchestrator
    participant Builder as 1. Builder Agent (Tác Giả)
    participant Editor as 2. Skill ai-first-doc-formatter (Biên Tập Viên)
    participant Linter as 3. Script verify-ai-first-format.py (Gác Cổng)
    participant Disk as 4. Codebase SSOT (Ổ Cứng)

    User->>Builder: Giao tác vụ giải thuật / sửa lỗi khó
    Note over Builder: 100% ATTENTION CHO LOGIC:<br/>Code chạy đúng, bảo toàn AST, đạt Exit Code 0
    Builder-->>Editor: Bàn giao Bản thảo kỹ thuật thô (Raw Truth)
    
    rect rgb(235, 245, 255)
    Note over Editor: BẬT THINKING BIÊN TẬP (Skill ai-first-doc-formatter):<br/>• Bóc tách Macro XML (instructions, context, output_contract)<br/>• Chưng cất YAML constraints và 3 điều must_not<br/>• Vẽ sơ đồ Mermaid trực quan hóa luồng dữ liệu<br/>• Gia tăng mật độ ngữ nghĩa, triệt tiêu văn xuôi kể lể
    end

    Editor->>Linter: Gửi tài liệu đã biên tập để kiểm định nhị phân
    Note over Linter: PYTHON MECHANICAL GATE (Exit Code 0/1):<br/>• YAML indentation <= 6 spaces<br/>• XML tag count <= 12<br/>• Link hygiene (0 backticks)
    
    alt Nếu vi phạm cú pháp vi mô (Exit Code 1)
        Linter-->>Editor: Báo lỗi chính xác dòng/cột -> Editor tự nắn lại
    else Nếu đạt chuẩn (Exit Code 0)
        Linter->>Disk: Cho phép ghi đĩa / commit thành SSOT
    end
```

---

## 4. Ma Trận 6 Điểm Định Vị Thời Điểm Biên Tập (Milestone Gating Matrix)

Thay vì chạy linter bắt bẻ từng bước gõ phím nhỏ, việc biên tập và kiểm định tài liệu được kích hoạt theo các **Mốc Chuyển Giao Quyết Định (Milestone Cognitive Gates)**:

```yaml
milestone_gates:
  gate_1_spec_approval:
    milestone: "Hoàn tất soạn thảo spec.md, plan.md, hoặc tasks.md."
    action: "BẮT BUỘC kích hoạt ai-first-doc-formatter biên tập trước khi bàn giao cho Builder."
    rationale: "Ngăn chặn ngộ độc ngữ cảnh trung gian (Context Poisoning) cho Builder."
  gate_2_daily_coding:
    milestone: "Builder đang viết mã nguồn src/** và unit tests."
    action: "VÔ HIỆU HÓA toàn bộ linter cú pháp hình thức trong PreToolUse."
    rationale: "Bảo tồn 100% Thinking Budget cho logic thuật toán và an toàn kiểu dữ liệu."
  gate_3_doc_publishing:
    milestone: "Xuất bản báo cáo kỹ thuật hoặc tài liệu kiến trúc Docs/**."
    action: "Chạy ai-first-doc-formatter và xác thực qua verify-ai-first-format.py."
    rationale: "Bảo đảm tài liệu lưu trữ lâu dài đạt chuẩn AI-First Triad."
  gate_4_chat_streaming:
    milestone: "Phản hồi hội thoại tương tác nhanh với người dùng."
    action: "Sử dụng Markdown tự nhiên, cấm ép thẻ XML macro phức tạp."
    rationale: "Cực tiểu hóa độ trễ phản hồi (Turn Latency)."
  gate_5_syntax_failure_threshold:
    milestone: "Tỷ lệ lỗi cú pháp bề mặt vượt quá 15% tổng số turn."
    action: "Tách bước biên tập tài liệu thành một Subagent riêng biệt (Dedicated Editor Subagent)."
    rationale: "Ngăn chặn vòng lặp sửa format vô tận trong phiên làm việc chính."
  gate_6_pre_commit_audit:
    milestone: "Chuẩn bị commit các thay đổi tài liệu vào Git."
    action: "Kích hoạt verify-ai-first-format.py tại Git pre-commit hook."
    rationale: "Chốt chặn cơ học cấp hệ điều hành đảm bảo zero vi phạm lọt vào repository."
```

---

## 5. Kết Luận Kiến Trúc

1. **Phân định dứt khoát**: Linter máy (Python) chịu trách nhiệm kiểm tra cú pháp nhị phân; Mô hình ngôn ngữ (qua Skill `ai-first-doc-formatter`) chịu trách nhiệm tư duy biên tập cấu trúc ngữ nghĩa.
2. **Khắc phục xung đột**: Loại bỏ hoàn toàn linter hình thức khỏi sự kiện `PreToolUse` trong lúc code; chỉ kích hoạt biên tập tại các mốc bàn giao đặc tả để triệt tiêu đồng thời cả hai nguy cơ *Attention Bleeding* và *Intermediate Context Poisoning*.

</context>

<output_contract>
```yaml
verification_gate:
  command: "python .agents/skills/ai-first-doc-formatter/scripts/verify-ai-first-format.py Docs/AGENTS_ANALYSTS/harness-architecture-evaluation/01-attention-pedantry-and-doc-formatting.md"
  expected_exit_code: 0
acceptance_criteria:
  - "Chứng minh sự khác biệt bản chất giữa Syntactic Linting và Semantic Distillation."
  - "Thiết lập mô hình Tác giả - Biên tập viên giải phóng Thinking Budget."
  - "Định vị 6 mốc kích hoạt biên tập ngăn chặn Context Poisoning."
```
</output_contract>
