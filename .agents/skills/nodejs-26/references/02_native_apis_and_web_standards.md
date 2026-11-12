# Nhóm 2: Web Standards & Native Core APIs

Một trong những định hướng lớn từ Node.js v22 đến v26 là tiệm cận tuyệt đối với Web Standards và giảm dần sự phụ thuộc vào các thư viện thứ 3.

---

## 1. URLPattern API khả dụng toàn cục (Global)
- **Trước đây (v22):** URLPattern bị ẩn đằng sau cờ thử nghiệm hoặc phải cài `path-to-regexp` / `urlpattern-polyfill`.
- **Node.js v26:** `URLPattern` có sẵn trên biến môi trường global.
- **Ứng dụng:** Giúp việc định tuyến (Routing) trong các web framework hoặc server HTTP native trở nên đồng nhất với trình duyệt:
  ```javascript
  const pattern = new URLPattern({ pathname: '/users/:id' });
  const match = pattern.exec('https://example.com/users/42');
  console.log(match.pathname.groups.id); // '42'
  ```

---

## 2. Nâng cấp Undici 8.x cho HTTP/Fetch
- Tầng mạng nền tảng của Node.js cho `fetch()`, `Request`, `Response`, và `FormData` được nâng cấp lên **Undici 8.x**.
- **Lợi ích:**
  - Tối ưu hóa throughput cho hàng triệu kết nối đồng thời.
  - Quản lý Connection Pooling và HTTP/2 Keep-Alive ổn định hơn.
  - Chuẩn hóa WebSocket client native (`new WebSocket(...)`), không cần cài đặt gói `ws` cho các nhu cầu tiêu chuẩn.

---

## 3. SQLite Native Database Module
- Module native `node:sqlite` được củng cố và hoàn thiện tính năng.
- Bổ sung sẵn các extension tính toán phần trăm và thống kê nâng cao (`median`, `percentile`), cho phép phát triển ứng dụng lưu trữ cục bộ, CLI, caching mà không cần build các binary SQLite native bên ngoài (như `better-sqlite3`).
