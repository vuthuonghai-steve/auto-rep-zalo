# BẢNG KIỂM TRA 6 TIÊU CHÍ GIAO VIỆC KHỬ Ô NHIỄM NGỮ CẢNH (DELEGATION CHECKLIST)

Tài liệu quy chuẩn tra cứu bắt buộc dành cho `host-orchestrator` trước khi thực thi bất kỳ lệnh `invoke_subagent` hoặc gửi tin nhắn `send_message` nào.

---

## 1. Bộ Tiêu Trí Đánh Giá 6 Điểm Nhị Phân (Evaluation Matrix)

Mọi Task Prompt trước khi phát đi phải thỏa mãn 100% các tiêu chí dưới đây:

| Mã Tiêu Chí | Tên Tiêu Chí | Định Nghĩa Cơ Học | Tiêu Chuẩn Đạt (Pass) |
| :--- | :--- | :--- | :--- |
| **CRIT-DEL-01** | **Cách Ly Ngữ Cảnh Tuyệt Đối (Clean Slate Isolation)** | Không truyền tóm tắt văn xuôi; chỉ truyền con trỏ đĩa cứng và git refs. | 0 dòng văn bản diễn giải chủ quan. |
| **CRIT-DEL-02** | **Khung Độc Lập Đối Kháng (Blind Adversarial Framing)** | Cấm mọi câu hỏi mớm ý hoặc giả định khẳng định; cấm `send_message` tới Auditor. | 0 câu hỏi `?`, 0 từ ngữ mớm ý. |
| **CRIT-DEL-03** | **Bán Kính Tác Động Tường Minh (Explicit Blast Radius)** | Khai báo danh mục tệp được phép sửa và tệp bất khả xâm phạm. | Liệt kê rõ `allowed_files` và `forbidden_files`. |
| **CRIT-DEL-04** | **Điều Kiện Dừng Nhị Phân (Binary Stop Condition)** | Tiêu chuẩn hoàn thành phải đo lường được bằng câu lệnh máy cụ thể. | Có chuỗi lệnh kiểm chứng (`test_command`). |
| **CRIT-DEL-05** | **Khế Ước Đầu Ra Cấu Trúc (Structured Output Contract)** | Ép buộc Subagent phản hồi theo JSON Schema hoặc Triad Envelope. | 100% phản hồi có schema cấu trúc. |
| **CRIT-DEL-06** | **Giới Hạn Tải Trọng Token (Payload Token Cap)** | Task Prompt ban đầu không vượt quá ngưỡng gây loãng chú ý ở Turn 1. | Tổng Task Prompt $\le 150$ tokens. |

---

## 2. Quy Trình Xuất Lệnh Giao Việc Tức Thì (Zero-IO Overhead)

1. **Không gọi `view_file` lặp lại**: Sử dụng các khung Pure Data Manifest đã nhúng sẵn ở tầng L0 trong `agent.md`.
2. **Điền giá trị neo đĩa cứng**:
   - `spec_path`: Đường dẫn tương đối từ gốc repository tới file đặc tả.
   - `task_id`: Mã định danh nguyên tử trong `tasks.md`.
   - `allowed_files` / `forbidden_files`: Mảng JSON các đường dẫn tệp.
   - `test_command`: Lệnh chạy test runner độc lập.
3. **Phát lệnh qua `invoke_subagent`**:
   - `spec-analyst-planner`: `Workspace: 'share'`
   - `surgical-implementer`: `Workspace: 'branch'`
   - `surgical-auditor`: `Workspace: 'inherit'`
   - `worktree-integrator`: `Workspace: 'inherit'`

---

## 3. Chính Sách Vòng Đời Bất Đối Xứng (Asymmetric Lifecycle Policy)

- **Với `surgical-auditor` (Stateless Ephemeral)**:
  - **CẤM TUYỆT ĐỐI** dùng `send_message` với Auditor. Mọi tranh luận sau phán quyết đều bị Dispatcher chặn đứng (`decision: deny`).
  - Nếu Auditor báo `FAIL`: Lấy JSON kết quả chuyển sang cho Builder sửa qua `send_message`, sau đó triệu hồi một Auditor mới tinh qua `invoke_subagent`.
- **Với `surgical-implementer` (Stateful)**:
  - Cho phép dùng `send_message` khi khắc phục lỗi sau kiểm toán.
  - Nội dung tin nhắn bắt buộc phải tuân theo khung `<remediation_manifest>` chỉ chứa tọa độ lỗi (`failure_coordinates`, `uncovered_criteria`), cấm kèm theo văn xuôi phỏng đoán cách sửa.
