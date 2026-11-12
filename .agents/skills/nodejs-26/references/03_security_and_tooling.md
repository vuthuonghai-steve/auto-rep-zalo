# Nhóm 3: Security & Trải Nghiệm Phát Triển (Tooling)

Nhóm tính năng này tập trung vào sự an toàn khi chạy ứng dụng và sự tiện lợi trong quá trình code hàng ngày.

---

## 1. Cơ chế cấp quyền bảo mật (Permission Model)

- Đã được chuẩn hóa từ trạng thái thử nghiệm ban đầu thành cơ chế bảo vệ phân tầng.
- Cho phép người vận hành và developer giới hạn quyền truy cập nhạy cảm của script Node.js:
  - `--allow-fs-read`, `--allow-fs-write`: Giới hạn thư mục được đọc/ghi.
  - `--allow-net`: Giới hạn các domain/IP được phép gửi request.
  - Giảm thiểu rủi ro từ các cuộc tấn công chuỗi cung ứng mã nguồn (Supply Chain Attacks / Malicious npm packages).

---

## 2. Type Stripping (Chạy TypeScript Native)

- Từ Node.js v22.6 trở đi và hoàn thiện ổn định ở Node.js v24 & v26: Hỗ trợ tước bỏ kiểu (Type Stripping) cho các tệp `.ts` trực tiếp mà không cần cờ thử nghiệm (`node app.ts`).
- **Phạm vi hỗ trợ:** Chỉ hỗ trợ cú pháp loại bỏ được (erasable syntax: types, interfaces, type annotations, `import type`).
- **Lưu ý quan trọng từ v26:** Cờ `--experimental-transform-types` đã bị **loại bỏ**. Các cú pháp TypeScript sinh mã thực thi (non-erasable syntax như `enum`, namespace có logic, constructor parameter properties) sẽ báo lỗi `ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX` nếu chạy trực tiếp. Dự án nên cấu hình `"erasableSyntaxOnly": true` trong `tsconfig.json`.
- Cho phép chạy ngay các script automation, tests, utilities mà không cần build phức tạp hay cài `ts-node`/`tsx`.

---

## 3. Cải tiến Native Test Runner (`node:test`)

- Bổ sung native coverage report, snapshot testing, mock module nâng cao và chế độ `--watch`.
- Đủ năng lực thay thế hoàn toàn các framework test nặng nề như `jest` hoặc `mocha` trong phần lớn dự án.

---

## 4. Tối ưu AsyncLocalStorage với AsyncContextFrame

- Node.js kích hoạt mặc định cơ chế `AsyncContextFrame` cấp V8 để theo dõi context bất đồng bộ cho `AsyncLocalStorage` (thay vì phụ thuộc vào `async_hooks` tốn tài nguyên trước đây).
- Giảm thiểu độ trễ phân bổ bộ nhớ (overhead), tăng thông lượng HTTP và khắc phục rò rỉ context trong môi trường microservices chịu tải cao.
- Có thể tắt bằng cờ `--no-async-context-frame` nếu cần tương thích ngược với công cụ legacy.

---

## 5. Nâng cấp npm lên phiên bản 11.20

- Đi kèm với bản LTS v26 là npm 11.
- Tốc độ resolve cây phụ thuộc nhanh hơn.
- Cải thiện cơ chế audit lỗ hổng bảo mật và xử lý workspace đa tầng mượt mà hơn.
