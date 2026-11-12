---
trigger: model_decision
description: "Quy chuẩn đóng neo ngữ nghĩa lai XML-YAML (Hybrid Semantic Anchors - C-QUAL-02): Kết hợp ranh giới đóng kín rõ ràng của XML với cấu trúc dữ liệu nghiêm ngặt của YAML."
---

# Quy Chuẩn Đóng Neo Ngữ Nghĩa Lai XML-YAML (Hybrid Semantic Anchors - C-QUAL-02)

Quy chuẩn kỹ thuật bắt buộc nhằm tối ưu hóa khả năng giao tiếp giữa hệ thống và các tác tử (System & Inter-Agent Communication), kết hợp sức mạnh đặc thù của cả hai định dạng:
- **XML Frame (Ranh giới tách biệt)**: Thiết lập biên độ đóng kín tuyệt đối trong không gian Attention của LLM, giúp phân lập rõ ràng giữa nội dung thảo luận và dữ liệu điều khiển hệ thống.
- **YAML Payload (Cấu trúc nghiêm ngặt)**: Cung cấp kiểu dữ liệu mạnh (strong typing: string, int, boolean, array, dict), cấu trúc phân cấp tinh gọn, không rườm rà thẻ đóng và mật độ ngữ nghĩa tối đa.

---

## 1. Cấu Trúc Khối Lai Chuẩn Hóa (XML-Wrapped YAML Architecture)

Mọi khối đóng neo trạng thái, chốt chặn kỹ thuật, hoặc gói tin trao đổi hệ thống **BẮT BUỘC** tuân thủ mô hình vỏ XML bọc dữ liệu YAML:

```xml
<fail_fast>
status: NOT_FOUND
error_classification: BOUNDARY_VIOLATION_OR_NON_EXISTENT_ENTITY
entity:
  name: "HyperQuantumSuperOptimizer"
  target_path: ".agents/quantum/"
audit_evidence:
  path_exists: false
  inspected_scope: "C:/workspace/.agents"
remedy: "Kiểm tra lại đường dẫn cài đặt hoặc bổ sung spec trước khi tiếp tục"
</fail_fast>
```

---

## 2. Các Ranh Giới Bất Biến (Architecture Invariants)

1. **Ranh giới vỏ bọc XML**:
   - Thẻ mở `<tag_name>` và thẻ đóng `</tag_name>` đứng ở dòng riêng biệt.
   - Tên thẻ XML thể hiện ngữ cảnh nghiệp vụ: `<context_anchor>`, `<fail_fast>`, `<task_dispatch>`, `<acceptance_payload>`, `<verification_result>`.
2. **Tính nghiêm ngặt của YAML bên trong**:
   - Tuân thủ chuẩn thụt dòng 2 khoảng trắng (2-space indentation).
   - Kiểu dữ liệu tường minh: chuỗi có nháy kép khi có ký tự đặc biệt, mảng phân cấp rõ ràng với dấu `-`.
   - CẤM sinh thẻ XML con bên trong nếu dữ liệu có thể biểu diễn bằng YAML key-value.
3. **Triệt tiêu Token Bloat**:
   - Việc loại bỏ các thẻ đóng XML con lồng nhau giúp giảm từ 30% đến 40% chi phí token so với XML thuần.
