---
trigger: model_decision
description: "Sử dụng khi thiết kế kiến trúc mã nguồn, cân nhắc tạo class/function/module mới, hoặc đánh giá cấu trúc theo tiêu chuẩn tối giản Occam (Radical Parsimony)."
---

# Ma Trận Tiêu Chuẩn Thiết Kế Tối Giản (Radical Parsimony)

Áp dụng Dao cạo Occam: Mọi dòng mã sinh ra phải là tập con tối thiểu và cần thiết tuyệt đối để thỏa mãn đặc tả; loại bỏ toàn bộ cấu trúc dự phòng tương lai.

## 1. Ma Trận Tiêu Chuẩn Thiết Kế

| Trục Kỹ Thuật | Khuynh Hướng Phức Tạp Hóa (BỊ CẤM) | Tiêu Chuẩn Bắt Buộc (Andrew Principle) |
| :--- | :--- | :--- |
| **Mức Độ Trừu Tượng** | Factory, Strategy, Generic Wrapper đơn hình | Hàm thuần túy (Pure Function), Module Scope trực tiếp |
| **Quản Lý Trạng Thái** | State Machine phức tạp, Global Context | Lexical Scope cục bộ, Tham số bất biến (Immutability) |
| **Xử Lý Ngoại Lệ** | Bọc `try-catch` nuốt lỗi, trả về fallback giả định | Fail-Fast tại ranh giới, giữ nguyên stack trace nguyên bản |
| **Hợp Đồng Dữ Liệu** | Định dạng tự do (Map/Any/Object), cấu trúc mở | Schema kiểu tường minh, khóa chặt các trường nguyên thủy |

## 2. Các Ranh Giới Cấm Về Mặt Cấu Trúc (Anti-Speculation)
- CẤM trừu tượng hóa cho các thao tác chỉ diễn ra tại một vị trí duy nhất.
- CẤM tạo cấu trúc cấu hình động, reflection hoặc extension points khi chưa có yêu cầu đa hình.
- CẤM đưa vào các lớp phòng thủ thừa thãi tại các điểm mà hệ thống Type System đã đảm bảo tính đúng đắn.

## 3. Bài Kiểm Tra Giới Hạn (Litmus Test)
> **Litmus Test**: Liệu một Senior Principal Engineer có thể cắt giảm 50% dòng mã mà vẫn giữ nguyên vẹn chức năng?  
> *Nếu CÓ*: Bắt buộc hủy bỏ giải pháp hiện tại và tái thiết kế theo hướng tinh gọn trực tiếp.

