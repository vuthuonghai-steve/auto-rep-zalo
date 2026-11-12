# Báo cáo Tổng hợp: So sánh Node.js v22.17.1 và Node.js LTS v26.13.0 (Lithium)

## 1. Thông tin chung về phiên bản
- **Phiên bản hiện tại trên máy:** `v22.17.1` (Nhánh v22 - Jod LTS)
- **Phiên bản LTS mới nhất:** `v26.13.0` (Nhánh v26 - Lithium LTS, chuyển sang LTS từ 10/2026)
- **Cột mốc chuyển tiếp:** Node.js v22 -> Node.js v24 (Krypton LTS) -> Node.js v26 (Lithium LTS).

---

## 2. Danh mục tài liệu chi tiết
Tài liệu phân tích được chia nhỏ thành các nhóm thông tin độc lập trong thư mục `Temps/Nodejs/`:

1. [`01_runtime_and_v8.md`](file:///C:/Users/ADMIN/Documents/workspace/Sales/EXTENSIONS/Temps/Nodejs/01_runtime_and_v8.md): Động cơ JavaScript V8, ECMAScript mới (Temporal API, Explicit Resource Management, RegExp.escape, Iterator sequencing).
2. [`02_native_apis_and_web_standards.md`](file:///C:/Users/ADMIN/Documents/workspace/Sales/EXTENSIONS/Temps/Nodejs/02_native_apis_and_web_standards.md): Cải tiến Web Standards (Undici 8, native fetch, URLPattern global, SQLite native).
3. [`03_security_and_tooling.md`](file:///C:/Users/ADMIN/Documents/workspace/Sales/EXTENSIONS/Temps/Nodejs/03_security_and_tooling.md): Bảo mật (Permission Model), Nâng cấp Tooling (npm 11, Node Test Runner, TypeScript Type Stripping).
4. [`04_breaking_changes_and_migration.md`](file:///C:/Users/ADMIN/Documents/workspace/Sales/EXTENSIONS/Temps/Nodejs/04_breaking_changes_and_migration.md): Các thay đổi phá vỡ (Breaking Changes), hàm bị xoá, lưu ý khi di chuyển mã nguồn và hướng dẫn cài đặt.

---

## 3. Tóm lược nâng cấp nhanh

| Tiêu chí | Bản hiện tại (`v22.17.1`) | Bản LTS mới (`v26.13.0`) |
| :--- | :--- | :--- |
| **V8 Engine** | v12.4 | **v14.6** (Hiệu năng V8 vượt trội) |
| **Temporal API** | Chưa có / Thử nghiệm gắn cờ | **Bật mặc định toàn cục** (thay thế hoàn hảo cho `Date`) |
| **Xử lý tài nguyên** | Thủ công (`try...finally`) | **Hỗ trợ `using` / `await using`** (Explicit Resource Management) |
| **URLPattern** | Cần cờ thử nghiệm | **Toàn cục (Global)** cho routing dễ dàng |
| **HTTP Engine** | Undici cũ | **Undici 8.x** (tối ưu hóa `fetch` và WebSockets) |
| **npm đi kèm** | npm 10.x / 11.7.0 | **npm 11.20.0** |
| **Database tích hợp** | SQLite thử nghiệm sơ khai | **SQLite native** hỗ trợ percentile, thống kê |
