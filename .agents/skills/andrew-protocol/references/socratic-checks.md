# Bộ Câu Hỏi Truy Vấn Ngược & 4 Tín Hiệu Tư Duy (S1–S4)

Trước khi viết bất kỳ dòng mã nào, Agent phải kích hoạt tối thiểu 4 tín hiệu tư duy sâu để loại bỏ khoảng trống ngữ nghĩa (Semantic Void):

```yaml
thought_latency_signals:
  S1_negation_density:
    mandate: "Xác định rõ Negative Space: Liệt kê tối thiểu 3-5 điều hệ thống CẤM LÀM kèm theo hậu quả nghiêm trọng."
    socratic_probe: "Nếu làm sai tác vụ này, điều tồi tệ nhất có thể xảy ra với codebase là gì?"

  S2_reverse_probing:
    mandate: "Truy vấn kịch bản sập nguồn và điểm nghẽn bộ nhớ/tài nguyên."
    socratic_probe: "Hàm này sẽ sập, timeout hoặc rò rỉ bộ nhớ thế nào trong điều kiện tải cao hoặc đầu vào dị thường?"

  S3_multi_stakeholder:
    mandate: "Phân tích tác động 4 chiều: Người dùng cuối, Developer bảo trì sau này, Hệ thống vận hành, Business."
    socratic_probe: "Một lập trình viên khác đọc đoạn code này 6 tháng nữa có hiểu ngay mà không cần hỏi lại không?"

  S4_constraint_anchoring:
    mandate: "Neo chặt giải pháp vào các ràng buộc vật lý, hệ điều hành (Windows paths, process limits, timeout)."
    socratic_probe: "Có phụ thuộc ngầm nào vào môi trường cục bộ đang bị bỏ qua không?"
```

## Khung Đánh Giá Rủi Ro Type 1 vs Type 2

$$\text{Risk Index} = \text{Blast Radius (1..4)} \times (5 - \text{Reversibility (1..4)})$$

- **Nếu $\text{Risk Index} \ge 8$ (Quyết định Type 1 - Bất khả nghịch)**:
  - DỪNG LẠI NGAY LẬP TỨC.
  - Lập bảng phân tích đánh đổi (trade-offs) và yêu cầu người dùng phê duyệt trước khi viết code.
- **Nếu $\text{Risk Index} < 8$ (Quyết định Type 2 - Khả nghịch)**:
  - Tự chủ giải quyết theo tiêu chuẩn phẫu thuật tối thiểu.
  - Cam kết kiểm chứng bằng lệnh test cơ học.

