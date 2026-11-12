---
name: nodejs-26
description: Hướng dẫn tiêu chuẩn lập trình, kiến trúc và khai thác các tính năng cốt lõi của Node.js 26 (LTS Lithium). Kích hoạt khi phát triển dự án với Node.js 26, tối ưu hóa runtime, viết TypeScript native (type stripping), sử dụng Temporal API, Explicit Resource Management (using), native SQLite (node:sqlite), native Test Runner (node:test), hoặc xử lý di chuyển và giải quyết breaking changes từ Node.js cũ sang Node.js 26.
---

# Kỹ năng Phát triển Dự án trên Nền tảng Node.js 26 (Lithium LTS)

Tài liệu hướng dẫn thực hành tốt nhất (Best Practices) và các tiêu chuẩn kỹ thuật khi xây dựng mã nguồn trên nền tảng **Node.js 26**.

Kỹ năng này áp dụng kiến trúc **Progressive Disclosure** (Tiết lộ lũy tiến) theo chuẩn `skill-creator`: tóm lược quy tắc cốt lõi tại `SKILL.md` và tổ chức tri thức chuyên sâu thành các tài liệu chuyên biệt trong thư mục `references/`.

---

## 1. Mục lục Tài liệu Tham chiếu Chuyên sâu (Bundled References)

Khi cần tra cứu sâu từng chủ đề hoặc giải quyết bài toán phức tạp, hãy đọc tệp tài liệu tương ứng trong `references/`:

| Tài liệu tham chiếu | Phạm vi & Nội dung chuyên sâu | Khi nào cần đọc? |
| :--- | :--- | :--- |
| [`01_runtime_and_v8.md`](file:///c:/Users/ADMIN/Documents/workspace/Sales/EXTENSIONS/.agents/skills/nodejs-26/references/01_runtime_and_v8.md) | Nâng cấp V8 v14.6, chi tiết Temporal API, Explicit Resource Management (`using`), `Map.prototype.getOrInsert()`, `Float16Array`, `Iterator.concat()`, `Error.isError()`. | Khi xử lý thời gian, tối ưu hóa bộ nhớ, giải phóng tài nguyên I/O hoặc xử lý cấu trúc dữ liệu mới. |
| [`02_native_apis_and_web_standards.md`](file:///c:/Users/ADMIN/Documents/workspace/Sales/EXTENSIONS/.agents/skills/nodejs-26/references/02_native_apis_and_web_standards.md) | Web Standards, URLPattern API toàn cục, Undici 8 (`fetch`, WebSockets native), `node:sqlite` database native & extension thống kê. | Khi viết API server, routing, xử lý HTTP request/client, caching hoặc lưu trữ database cục bộ. |
| [`03_security_and_tooling.md`](file:///c:/Users/ADMIN/Documents/workspace/Sales/EXTENSIONS/.agents/skills/nodejs-26/references/03_security_and_tooling.md) | Permission Model phân tầng, TypeScript Native Type Stripping, Native Test Runner (`node:test`), AsyncLocalStorage với `AsyncContextFrame`, npm 11. | Khi thiết lập dự án TypeScript, viết test, cấu hình quyền bảo mật runtime hoặc tracking context bất đồng bộ. |
| [`04_breaking_changes_and_migration.md`](file:///c:/Users/ADMIN/Documents/workspace/Sales/EXTENSIONS/.agents/skills/nodejs-26/references/04_breaking_changes_and_migration.md) | Danh mục Breaking Changes, xoá bỏ `writeHeader`, xoá module `_stream_*`, ABI Native Module (`NODE_MODULE_VERSION = 147`), toolchain Windows ClangCL. | Khi nâng cấp dự án từ Node.js v22/v24 lên v26, sửa lỗi build C++ Native Addon hoặc gặp lỗi runtime không tương thích. |
| [`README.md`](file:///c:/Users/ADMIN/Documents/workspace/Sales/EXTENSIONS/.agents/skills/nodejs-26/references/README.md) | Báo cáo so sánh tổng thể giữa Node.js v22.17.1 và Node.js v26.13.0 (Lithium LTS). | Khi cần bức tranh tổng quan và bảng đối chiếu thông số giữa hai bản LTS. |

---

## 2. Nguyên tắc Cốt lõi (Core Principles)
- **Chuẩn hóa Web Standards & Native-First:** Ưu tiên sử dụng API có sẵn của Node.js (`fetch`, `URLPattern`, `WebSocket`, `node:sqlite`, `node:test`) thay vì đưa vào các thư viện thứ 3 cồng kềnh (`axios`, `path-to-regexp`, `better-sqlite3`, `jest`).
- **Occam's Parsimony (Andrew Principles):** Không cài đặt thêm package khi runtime đã có sẵn giải pháp tiêu chuẩn.
- **Bảo toàn khả năng tương thích kiểu (Erasable Syntax Only):** Khai thác tính năng Native Type Stripping nhưng tuân thủ nghiêm ngặt chuẩn ECMAScript thuần.

---

## 3. Các Mẫu Lập trình Tiêu chuẩn (Standard Patterns)

### 3.1. Quản lý Thời gian với `Temporal` API (Thay thế hoàn toàn `Date`)
Node.js 26 kích hoạt mặc định toàn cục `Temporal`. Không dùng thư viện ngoài (`moment`, `dayjs`, `date-fns`) trừ khi có nhu cầu đặc thù.

```javascript
// Tính toán ngày hết hạn với múi giờ cụ thể
const now = Temporal.Now.zonedDateTimeISO('Asia/Ho_Chi_Minh');
const expirationDate = now.add({ days: 30, hours: 2 });

// So sánh và tính khoảng cách
const duration = now.until(expirationDate);
console.log(duration.total({ unit: 'hour' })); // Giờ chính xác tính cả DST
```
*(Chi tiết xem [`01_runtime_and_v8.md`](file:///c:/Users/ADMIN/Documents/workspace/Sales/EXTENSIONS/.agents/skills/nodejs-26/references/01_runtime_and_v8.md))*

### 3.2. Quản lý Giải phóng Tài nguyên với `using` & `await using`
Khai thác tính năng **Explicit Resource Management** để tự động đóng file, database cursor, socket:

```javascript
import fs from 'node:fs/promises';

async function processFile(filePath) {
  // Tự động đóng file handle khi ra khỏi scope block
  await using fileHandle = await fs.open(filePath, 'r');
  const content = await fileHandle.readFile('utf-8');
  return JSON.parse(content);
}
```

### 3.3. Routing & URL Matching với `URLPattern`
Dùng `URLPattern` toàn cục để xây dựng router hoặc parse parameters:

```javascript
const route = new URLPattern({ pathname: '/api/v1/orders/:orderId' });
const match = route.exec(req.url, 'http://localhost');

if (match) {
  const { orderId } = match.pathname.groups;
  // Xử lý orderId
}
```
*(Chi tiết xem [`02_native_apis_and_web_standards.md`](file:///c:/Users/ADMIN/Documents/workspace/Sales/EXTENSIONS/.agents/skills/nodejs-26/references/02_native_apis_and_web_standards.md))*

### 3.4. Lưu trữ Dữ liệu Cục bộ & Cache với `node:sqlite`
Sử dụng module native `node:sqlite` kèm extension thống kê phân vị (percentile) có sẵn từ v26:

```javascript
import { DatabaseSync } from 'node:sqlite';

const db = new DatabaseSync(':memory:');
db.exec(`
  CREATE TABLE metrics (id INTEGER PRIMARY KEY, latency REAL);
  INSERT INTO metrics (latency) VALUES (12.5), (45.2), (18.1), (92.4);
`);

// Sử dụng percentile native
const query = db.prepare('SELECT percentile(latency, 95) AS p95 FROM metrics');
const result = query.get();
console.log(`P95 Latency: ${result.p95}ms`);
```

### 3.5. Viết Test Đơn vị với Native Test Runner (`node:test`)
Không dùng `jest` hay `mocha`. Dùng native test runner tích hợp sẵn mock và assertion:

```javascript
import { test, describe, mock } from 'node:test';
import assert from 'node:assert/strict';

describe('Order Service', () => {
  test('tính toán tổng hoá đơn chính xác', () => {
    const fn = mock.fn((price, qty) => price * qty);
    const total = fn(100, 2);
    
    assert.equal(total, 200);
    assert.equal(fn.mock.callCount(), 1);
  });
});
```
*Chạy test trực tiếp:* `node --test` hoặc `node --test --watch`.
*(Chi tiết xem [`03_security_and_tooling.md`](file:///c:/Users/ADMIN/Documents/workspace/Sales/EXTENSIONS/.agents/skills/nodejs-26/references/03_security_and_tooling.md))*

---

## 4. Quy chuẩn TypeScript Native (Type Stripping)

Node.js 26 hỗ trợ chạy trực tiếp file `.ts` bằng cơ chế Type Stripping (loại bỏ kiểu dữ liệu lúc runtime).

### 4.1. Ràng buộc Cú pháp Bắt buộc
Vì Node.js 26 đã **loại bỏ hoàn toàn cờ `--experimental-transform-types`**, mã TypeScript chạy trực tiếp trên Node.js **CHỈ ĐƯỢC PHÉP DÙNG ERASABLE SYNTAX**:

- ✅ **ĐƯỢC DÙNG:**
  - `type` aliases và `interface`
  - Type annotations (`x: string`, `y: number[]`)
  - `import type { Foo } from './foo.js'`
  - Generics, type casting (`value as string`)
- ❌ **CẤM DÙNG (Gây lỗi `ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX`):**
  - TypeScript `enum` (Giải pháp: dùng `const ENUM = { ... } as const`)
  - Constructor parameter properties (`constructor(public id: string) {}` -> Cần gán `this.id = id` thủ công)
  - `namespace` có chứa mã logic thực thi

### 4.2. Cấu hình Khuyến nghị `tsconfig.json`
```json
{
  "compilerOptions": {
    "target": "ES2024",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "erasableSyntaxOnly": true,
    "verbatimModuleSyntax": true,
    "strict": true,
    "noEmit": true
  }
}
```

---

## 5. Danh mục Cấm và Cảnh báo Phá vỡ (Breaking Changes)

1. **CẤM sử dụng `http.Server.prototype.writeHeader()`:**
   - Đã bị xoá triệt để khỏi Node.js 26.
   - Bắt buộc dùng `res.writeHead(statusCode, headers)`.
2. **CẤM import module stream nội bộ cũ:**
   - Các module `_stream_wrap`, `_stream_readable`, `_stream_writable`, `_stream_duplex`, `_stream_transform`, `_stream_passthrough` đã bị xoá.
   - Chỉ import từ `'node:stream'` (hoặc `node:stream/promises`, `node:stream/web`).
3. **Thận trọng với Native Addons (C++):**
   - Node.js 26 sử dụng `NODE_MODULE_VERSION = 147`.
   - Nếu build trên Windows: Bắt buộc dùng toolchain **ClangCL** (thông qua Visual Studio Installer chọn LLVM clang-cl), MSVC truyền thống không còn được hỗ trợ để build V8 v14.6.
   - Sau khi cài package native, chạy `npm rebuild` để biên dịch lại đúng ABI 147.
4. **Context Tracing:**
   - Mặc định sử dụng `AsyncContextFrame` thay thế cho `async_hooks` cũ. Đảm bảo các thư viện APM/OpenTelemetry được cập nhật lên phiên bản tương thích Node 24+.

*(Chi tiết xem [`04_breaking_changes_and_migration.md`](file:///c:/Users/ADMIN/Documents/workspace/Sales/EXTENSIONS/.agents/skills/nodejs-26/references/04_breaking_changes_and_migration.md))*
