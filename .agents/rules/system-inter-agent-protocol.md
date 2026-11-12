---
trigger: model_decision
description: "Quy thức giao tiếp liên tác tử lai XML-YAML (Hybrid Inter-Agent Protocol): Kết hợp vỏ bọc ranh giới XML với cấu trúc dữ liệu nghiêm ngặt của YAML cho các gói tin hệ thống."
---

# Quy Thức Giao Tiếp Liên Tác Tử Lai XML-YAML (Hybrid Inter-Agent Protocol)

Quy định kỹ thuật bắt buộc khi các tác tử (Agent, Subagents, Orchestrator, Auditor) trao đổi thông điệp qua `send_message` hoặc xuất báo cáo bàn giao:

## 1. Mô Hình Gói Tin Lai (Hybrid Packet Model)

Mọi gói tin giao tiếp hệ thống được đóng gói theo cấu trúc:
- **XML Wrapper Tag**: Định danh mục đích nghiệp vụ (`<task_dispatch>`, `<task_status>`, `<audit_report>`).
- **YAML Inner Body**: Cấu trúc dữ liệu nghiêm ngặt, kiểu dữ liệu phân cấp, không có thẻ XML lồng nhau thừa thãi.

```xml
<task_dispatch>
task_id: "TASK-20261112-AUDIT-02"
assigned_subagent: "surgical-auditor"
execution_mode: "strict_deterministic"
scope:
  target_path: "C:/workspace/Sales/EXTENSIONS"
  rules_enforced:
    - "semantic-anchors.md"
    - "markdown-response-style.md"
objectives:
  - "Rà soát tính hợp lệ của cấu trúc lai XML-YAML"
  - "Xác minh 0 lỗi parse và 0% suy giảm sức mạnh model"
</task_dispatch>
```

## 2. Ưu Điểm Vượt Trội Của Kiến Trúc Lai
1. **Khóa Attention Ranh Giới (XML)**: LLM tiếp nhận gói tin nhận diện ngay lập tức phạm vi bắt đầu và kết thúc của thông điệp thông qua thẻ đóng mở.
2. **Nghiêm Ngặt & Tinh Gọn (YAML)**: Mô hình không phải tốn thời gian và token để sinh thẻ đóng cho từng thuộc tính con (`</task_id>`, `</scope>`, `</objectives>`), đồng thời duy trì schema dữ liệu kiểu mạnh (Strong Typing).
3. **An Toàn Tuyệt Đối Trên Shell CLI**: Không sử dụng attributes có nháy kép trên thẻ mở `<tag>`, loại trừ 100% rủi ro xung đột chuỗi tham số dòng lệnh.
