Tệp cấu hình custom agent trong [Google Antigravity](https://antigravity.google/docs/subagents/) là một tệp Markdown (`.md`) duy nhất kết hợp giữa **YAML Frontmatter** (siêu dữ liệu, quyền hạn và chính sách thực thi) và **Markdown Body** (chỉ thị hệ thống - System Prompt).

---

### 1. Trọn bộ thuộc tính cấu hình trong YAML Frontmatter

Phần Frontmatter nằm ở đầu tệp, giới hạn giữa cặp dấu `---`. Bảng dưới đây liệt kê đầy đủ các thuộc tính được hỗ trợ:

| Thuộc tính | Kiểu dữ liệu | Mặc định | Giá trị hợp lệ | Chức năng & Bài toán đảm nhiệm |
| --- | --- | --- | --- | --- |
| `name` | string | *(Bắt buộc)* | Tên định danh (kebab-case) | Xác định định danh duy nhất của agent khi gọi lệnh, hiển thị trong danh sách UI hoặc dùng trong cú pháp `@<name>`. |
| `description` | string | *(Bắt buộc)* | Chuỗi văn bản mô tả | Cung cấp thông tin nghiệp vụ để Planner/Parent Agent đọc hiểu và tự động ủy quyền công việc qua `invoke_subagent`. |
| `tools` | string[] | `[]` | Danh sách tên công cụ | Giới hạn quyền gọi công cụ (tool allowlist). Giúp thu hẹp ngữ cảnh, chống ảo giác công cụ và tránh việc agent vô tình gọi các thao tác phá hoại. |
| `mainAgent` | boolean | `true` | `true`, `false` | Quyết định agent có thể chạy độc lập như phiên làm việc chính hay không (chọn trên dropdown của IDE Side Panel, App, hoặc CLI `agy --agent <name>`). |
| `subagent` | boolean | `true` | `true`, `false` | Cho phép agent được gọi làm worker chạy ngầm bởi agent khác thông qua tool `invoke_subagent`. |
| `model` | string | `inherit` | `inherit`, `flash`, `pro` | Điều phối năng lực tính toán và chi phí: `flash` (tốc độ cao, chi phí thấp cho linting/format), `pro` (suy luận sâu cho kiến trúc/bảo mật), `inherit` (dùng model theo phiên cha). |
| `commandExecutionPolicy` | string | `sandbox` | `off`, `auto`, `eager`, `sandbox` | Kiểm soát mức độ tự động chạy lệnh shell trong [Terminal Sandbox](https://antigravity.google/docs/agent-settings/): `auto` (chạy ngầm các lệnh an toàn như test/build, chỉ hỏi khi có lệnh nguy hiểm), `sandbox` (cách ly OS container), `off` (hỏi mọi lệnh), `eager` (chạy thẳng không hỏi). |
| `permissionMode` | string | `request-review` | `request-review`, `strict`, `proceed-in-sandbox`, `always-proceed` | Thiết lập hạn mức kiểm duyệt chung cho mọi thao tác chỉnh sửa tệp hoặc gọi tài nguyên nhạy cảm. |
| `skills` | string[] | `[]` | Mảng đường dẫn thư mục skill | Nạp các gói quy trình nghiệp vụ chuyên biệt (ví dụ: `skills/db-migration`) theo cơ chế progressive discovery mà không làm tràn context window. |
| `plugins` | string[] | `[]` | Mảng tên plugin | Khai báo các plugin phụ thuộc cần nạp cùng với agent. |
| `mcpServers` | object[] | `[]` | Mảng cấu hình MCP server | Kết nối trực tiếp với các máy chủ Model Context Protocol (stdio hoặc remote SSE) để bổ sung công cụ ngoài. |

---

### 2. Danh mục các hàm & công cụ (`tools`) được cấp phát

Khi khai báo mảng `tools:`, bạn có thể chỉ định chính xác các công cụ tích hợp sẵn theo từng nhóm nhiệm vụ được tài liệu [Google Antigravity Hooks & Tools](https://antigravity.google/docs/hooks/) quy định:

#### Nhóm thao tác tệp và thư mục (Filesystem)

* `view_file`: Đọc nội dung tệp với hỗ trợ cắt dòng (`StartLine`, `EndLine`), phục vụ việc phân tích code cục bộ.
* `list_dir`: Liệt kê các tệp/thư mục con tại một đường dẫn xác định.
* `find_by_name`: Quét tìm tệp theo mẫu glob pattern, loại tệp và phần mở rộng.
* `grep_search`: Tìm kiếm từ khóa hoặc biểu thức chính quy (regex) xuyên suốt repository.
* `write_to_file`: Tạo mới hoàn toàn một tệp hoặc ghi đè toàn bộ nội dung.
* `replace_file_content`: Thay thế chính xác một khối văn bản liên tục trong tệp code.
* `multi_replace_file_content`: Thực hiện nhiều đoạn chỉnh sửa không liên tục trên cùng một tệp cùng lúc để tối ưu thời gian phản hồi.

#### Nhóm thực thi lệnh và quản lý tiến trình (Terminal & Execution)

* `run_command`: Đề xuất và thực thi lệnh shell/Bash (như chạy test, build, lint, git).
* `manage_task`: Quản lý các tiến trình chạy ngầm dài hạn với các hành động `list`, `status`, `send_input`, hoặc `kill`.
* `schedule`: Thiết lập hẹn giờ hoặc lên lịch cron job định kỳ chạy ngầm cho tác vụ giám sát.

#### Nhóm điều phối đa Agent (Multi-Agent Orchestration)

* `invoke_subagent`: Khởi tạo và ủy quyền một tác vụ con sang subagent khác với không gian bộ nhớ (context window) hoàn toàn mới.
* `ask_permission`: Gửi yêu cầu cấp thêm quyền thực thi đặc biệt đến người dùng khi gặp giới hạn an toàn.
* `list_permissions`: Kiểm tra danh sách các quyền hiện tại đang được cấp trong phiên làm việc.

---

### 3. Cấu trúc phần thân Markdown (System Prompt)

Phần nội dung bên dưới dấu `---` được biên dịch trực tiếp thành System Prompt của agent. Một cấu trúc chuẩn thường bao gồm 4 khối chỉ thị:

1. **Role & Objective (`# Role & Objective`):** Khẳng định vai trò chuyên môn, ngữ cảnh dự án và mục tiêu cốt lõi.
2. **Standard Workflow (`# Workflow`):** Trình bày quy trình giải quyết vấn đề tuần tự (ví dụ: Khảo sát mã nguồn -> Đề xuất kế hoạch -> Thực thi -> Chạy kiểm thử xác minh).
3. **Guardrails & Constraints (`# Constraints`):** Các ranh giới cấm vượt qua (ví dụ: không được sửa trực tiếp file `.env`, không được commit code khi test chưa pass, không gọi lệnh ngoài sandbox).
4. **Output Standards (`# Output Standards`):** Quy định định dạng báo cáo, cấu trúc tóm tắt hoặc mẫu checklist kết quả trả về cho Parent Agent hoặc lập trình viên.

---

### 4. Tệp mẫu cấu hình hoàn chỉnh (`api-tester.md`)

Dưới đây là một tệp hoàn chỉnh thiết lập chuyên viên kiểm thử API, tối ưu cho môi trường lập trình:

```markdown
---
name: api-tester
description: Tự động phân tích endpoint, viết test case, chạy kiểm thử API và báo cáo hiệu năng.
tools:
  - view_file
  - replace_file_content
  - write_to_file
  - grep_search
  - run_command
  - manage_task
mainAgent: true
subagent: true
model: pro
commandExecutionPolicy: auto
permissionMode: request-review
skills:
  - skills/rest-standards
---

# Role & Objective
Bạn là Kỹ sư Tự động hóa Kiểm thử API (API Automation Engineer). Mục tiêu chính là rà soát các route xử lý request, xây dựng kịch bản kiểm thử tích hợp (integration tests) và xác nhận tính toàn vẹn của dữ liệu đầu ra.

# Operational Workflow
1. Khảo sát route: Sử dụng `grep_search` và `view_file` để tìm kiếm controller, schemas, và middleware liên quan.
2. Thiết kế kịch bản test: Viết kịch bản kiểm tra mã trạng thái HTTP, xác thực token, kiểm thử biên và kiểm thử lỗi validation.
3. Tạo tệp kiểm thử: Dùng `write_to_file` để sinh mã kiểm thử vào thư mục `tests/api/`.
4. Thực thi và khắc phục: Dùng `run_command` chạy test runner (ví dụ: `npm test` hoặc `pytest`). Nếu có lỗi phát sinh, dùng `replace_file_content` để hiệu chỉnh lại cho tới khi toàn bộ suite vượt qua kiểm thử thành công.

# Constraints & Rules
- Chỉ thực thi các lệnh chạy test và cài đặt phụ thuộc thông qua chính sách `auto`. Không chạy lệnh phá hủy cơ sở dữ liệu production.
- Không hardcode chuỗi bí mật, token hoặc mật khẩu trong mã kiểm thử; luôn đọc qua biến môi trường giả lập (`.env.test`).
- Phải đính kèm chi tiết mã trạng thái HTTP mong đợi và mã trạng thái thực tế trong mọi báo cáo kiểm thử.

```
