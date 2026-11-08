---
trigger: model_decision
description: "Cấu trúc báo cáo hoàn thành tác vụ bắt buộc và cổng kiểm định nhị phân (Binary Definition of Done) trước khi bàn giao mã nguồn."
---

# Khế Ước Đầu Ra (Output Contract) & Cổng Kiểm Soát Nhị Phân (DoD Gates)

Báo cáo hoàn thành tác vụ của Agent bắt buộc phải tuân thủ cấu trúc dữ liệu chuẩn hóa 3 khối:

```yaml
acceptance_payload_schema:
  1_cognitive_preflight:
    assumptions_declared: "Danh sách giả định kỹ thuật đã kiểm chứng."
    clarifications_resolved: "Các điểm rẽ nhánh ngữ nghĩa đã được thống nhất."
    targeted_ast_scope: "Định danh cụ thể các file, module và hàm nằm trong phạm vi can thiệp."

  2_surgical_diff:
    format: "Unified Diff nguyên bản, cô lập tuyệt đối tại điểm đích, không chứa mã thừa/reformat."

  3_mechanical_proof:
    command: "Lệnh thực thi cơ học đã chạy (e.g., test runner, build script, linter)."
    exit_code: 0
    verification_summary: "Bằng chứng nhị phân xác thực toàn bộ kiểm thử đã vượt qua."
```

## Bảng Kiểm Định Hoàn Thành (Binary Definition of Done - DoD)

Mọi tác vụ chỉ được kết luận là hoàn thành khi vượt qua 5 cổng kiểm soát nhị phân sau:

| Cổng Kiểm Soát | Tiêu Chí Kiểm Tra | Loại Kiểm Chứng |
| :--- | :--- | :--- |
| **Gate 1: Semantic Integrity** | Mã giải quyết trọn vẹn yêu cầu; zero giả định ngầm trong khoảng trống ngữ nghĩa. | Boolean Thinking |
| **Gate 2: Parsimony Compliance** | Không chứa cấu trúc trừu tượng đầu cơ, interface đơn hình, hoặc cấu hình dự phòng. | Boolean Thinking |
| **Gate 3: Blast Radius Containment** | 100% dòng mã thay đổi có ánh xạ trực tiếp tới yêu cầu; zero đột biến lân cận. | Boolean Cơ Học (Git Diff) |
| **Gate 4: Anti-Entropy Clean** | Toàn bộ biến, import, kiểu dữ liệu mồ côi do thay đổi sinh ra đã được quét sạch. | Boolean Cơ Học (Linter/Compiler) |
| **Gate 5: Mechanical Validation** | Bằng chứng cơ học đạt Exit Code 0; zero placeholder (TODO, Stub, Mock) trên luồng chính. | Boolean Cơ Học (Exit Code 0) |

