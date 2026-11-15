# SỔ TAY XỬ LÝ NGOẠI LỆ ĐIỀU PHỐI LIÊN TÁC TỬ (EXCEPTION HANDLING PLAYBOOKS)

Tài liệu quy chuẩn cứu nguy dành cho `host-orchestrator` khi phát sinh các sự cố ngoài luồng trong quá trình điều phối Subagents. Chỉ nạp vào context khi sự cố thực sự xảy ra (Progressive Discovery).

---

## Playbook 1: Cơ Chế Ngắt Mạch Khi Task Trượt Audit Quá 3 Lần (Audit Failure Loop Circuit Breaker)

### Điều kiện kích hoạt:
Khi một task nguyên tử (`TSK-xx`) nhận phán quyết `FINAL VERDICT: FAIL` từ `surgical-auditor` đến lần thứ 3 liên tiếp dù đã qua 2 lượt gửi `<remediation_manifest>` cho `surgical-implementer`.

### Quy trình xử lý cơ học:
1. **Lập tức kích hoạt Ngắt Mạch (Trip Circuit Breaker)**: Tuyệt đối CẤM tiếp tục gọi `send_message` cho Builder hoặc triệu hồi thêm Auditor thứ 4 (tránh vòng lặp vô tận tiêu hao token).
2. **Thu thập bằng chứng đối kháng tĩnh**:
   - Chạy `git diff main...subagent/TSK-xx` để lưu trữ snapshot hiện tại.
   - Trích xuất 3 phán quyết FAIL của 3 Auditor độc lập kèm các tọa độ `failure_coordinates` và `uncovered_criteria`.
3. **Kích hoạt Cổng Can Thiệp Con Người (Human-in-the-Loop Intervention Gate)**:
   - Sử dụng `ask_permission` hoặc báo cáo trực tiếp cho người dùng.
   - Cung cấp 3 phương án lựa chọn nhị phân:
     - **Option A (Hạ chuẩn đặc tả)**: Yêu cầu `spec-analyst-planner` nới lỏng hoặc sửa lại Acceptance Criteria trong `spec.md` nếu đặc tả bất khả thi.
     - **Option B (Tái lập trình từ đầu)**: Tiêu diệt worker hiện tại, reset branch về trạng thái clean và khởi tạo Builder mới với chỉ dẫn bổ sung.
     - **Option C (Thủ công can thiệp)**: Người dùng trực tiếp sửa lỗi trên branch `subagent/TSK-xx`.

---

## Playbook 2: Xử Lý Xung Đột Merge Git Trên Worktree (Git Merge Conflict Resolution)

### Điều kiện kích hoạt:
Khi `worktree-integrator` thực thi `git merge --no-ff subagent/TSK-xx` vào nhánh chính và phát sinh xung đột (`Automatic merge failed; fix conflicts and then commit the result`).

### Quy trình xử lý cơ học:
1. **Thực thi Fail-Fast tức thì**:
   - `worktree-integrator` TUYỆT ĐỐI KHÔNG tự phỏng đoán nội dung để sửa conflict.
   - Chạy ngay lập tức: `git merge --abort`.
2. **Khôi phục trạng thái Clean Working Tree**:
   - Xác nhận `git status` trả về `working tree clean`.
3. **Báo cáo tọa độ xung đột cho Host Orchestrator**:
   - Trả về danh sách tệp bị xung đột (`conflicting_files`).
4. **Kế hoạch hòa giải của Orchestrator**:
   - Kiểm tra lại đồ thị DAG trong `tasks.md`: Nhiệm vụ bị xung đột có thực sự là độc lập (`[P]`) hay có sự giao thoa tệp (File Intersection) với task vừa merge trước đó?
   - Nếu vi phạm Disjoint File Sets: Tạm dừng các task song song khác, rebase nhánh `subagent/TSK-xx` lên đỉnh mới nhất của nhánh chính, sau đó triệu hồi lại `surgical-auditor` kiểm toán trước khi merge lại.

---

## Playbook 3: Xử Lý Treo Tiến Trình & Thu Hồi Tài Nguyên (Resource Teardown Recovery)

### Điều kiện kích hoạt:
Khi một Subagent bị treo không phản hồi sau thời gian quy định, hoặc Go Engine không tự động giải phóng Worktree sau khi kết thúc task.

### Quy trình xử lý cơ học:
1. **Tiêu diệt cưỡng chế qua Quản Trị Tác Tử**:
   - Gọi `manage_subagents(Action: 'kill', ConversationIds: [id])`.
2. **Dọn dẹp Worktree & Nhánh Tạm Thủ Công**:
   - Chạy `git worktree list` kiểm tra danh sách worktree còn tồn tại.
   - Nếu còn worktree mồ côi: Chạy `git worktree prune` hoặc `git worktree remove <path> --force`.
   - Chạy `git branch -D subagent/TSK-xx` đối với các nhánh tạm chưa được dọn dẹp.
3. **Kiểm tra khóa tệp trên Windows**:
   - Nếu gặp lỗi `Resource busy` hoặc `Access Denied` do tiến trình Windows chưa nhả handle, đợi 2000ms rồi thử lại với `clean-worktree` skill.
