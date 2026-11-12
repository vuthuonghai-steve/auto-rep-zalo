# Nhóm 1: Nâng Cấp Runtime & Động Cơ V8

So với bản `v22.17.1` (sử dụng V8 v12.4), phiên bản `v26.13.0` tích hợp **V8 v14.6** (tương đương nền tảng Chromium 146).

---

## 1. Temporal API (Bật mặc định toàn cục)
- **Trước đây (v22):** Lập trình viên phụ thuộc vào `Date` (nhiều lỗi thiết kế, parse múi giờ phức tạp) hoặc phải cài thêm các thư viện bên ngoài như `date-fns`, `dayjs`, `luxon`.
- **Node.js v26:** `Temporal` đã trở thành chuẩn global chính thức.
- **Tính năng nổi bật:**
  - Bất biến (Immutable).
  - Hỗ trợ đầy đủ múi giờ IANA, lịch phi Gregory, quy tắc đổi giờ mùa hè (DST).
  - Cú pháp ví dụ:
    ```javascript
    const start = Temporal.ZonedDateTime.from('2026-11-01T09:00[Asia/Ho_Chi_Minh]');
    const deadline = start.add({ days: 30 });
    ```

---

## 2. Explicit Resource Management (`using` & `await using`)
- Cho phép quản lý giải phóng bộ nhớ và tài nguyên ngoại vi (file descriptor, socket kết nối database, luồng I/O) theo chuẩn ECMAScript mới.
- Khối tài nguyên được tự động giải phóng qua `[Symbol.dispose]` hoặc `[Symbol.asyncDispose]` ngay khi ra khỏi scope block mà không cần phụ thuộc vào việc viết `try...finally`.
- Cú pháp:
  ```javascript
  {
    using handle = openResource();
    // Tự động giải phóng handle khi ra khỏi scope
  }
  ```

---

## 3. Các hàm và đối tượng ECMAScript mới trên V8 v14.6
- **`RegExp.escape(string)`:** Escape an toàn chuỗi đầu vào để chèn vào biểu thức Regex mà không cần viết hàm helper thủ công.
- **`Map.prototype.getOrInsert()` & `Map.prototype.getOrInsertComputed()`:** Thao tác Upsert trên Map/WeakMap trong 1 câu lệnh duy nhất.
- **`Iterator.concat(...)`:** Nối nhiều iterator mà không cần chuyển đổi sang Array tạm thời, tối ưu hoá bộ nhớ.
- **`Float16Array`:** Mảng định kiểu 16-bit Float, tăng tốc xử lý dữ liệu tính toán khoa học, AI và đồ họa.
- **`Error.isError()`:** Kiểm tra an toàn một giá trị có phải là Error object hay không (vượt qua ranh giới giữa các realm/context).
- **WebAssembly Memory64:** Mở rộng kiến trúc địa chỉ 64-bit cho các module WebAssembly.
