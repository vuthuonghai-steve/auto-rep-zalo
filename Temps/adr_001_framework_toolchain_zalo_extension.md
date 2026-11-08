# TÀI LIỆU NGỮ CẢNH & HỒ SƠ QUYẾT ĐỊNH KIẾN TRÚC (ADR-001: FRAMEWORK & TOOLCHAIN SELECTION)

**Dự án**: Hệ thống Tự Động Hóa Thu Thập, Biên Tập & Phân Phối Tin Nhắn Zalo Đa Nhóm (Personal Account 24/7)  
**Giai đoạn Quy trình**: Stage 3 — Architecture & Tech Selection (Chuẩn 8-Stage Unified Pipeline)  
**Trạng thái**: Đề xuất Phê duyệt (Proposed for Stage 4 MVP Viability Gate)  
**Ngày lập**: 08/11/2026  
**Kiến trúc đích**: [Chrome Extension Manifest V3](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts) + [TypeScript](https://www.typescriptlang.org/) + [Dexie.js](https://dexie.org/) (IndexedDB)

## 1. Neo Đậu Ngữ Nghĩa & Tư Duy Chiều Sâu (Domain Anchoring & 4 Depth Signals)

Mọi lựa chọn công nghệ trong tài liệu này là **đầu ra (Output)** trực tiếp từ các ràng buộc vận hành khắt khe của dự án Zalo Personal Automation 24/7 (90% nghiệp vụ nằm ở Content Script tương tác DOM React 18 của Zalo Web, khử trùng lặp 30 ngày qua IndexedDB, và cơ chế Chuyển tiếp 2 Pha).

### 1.1. Phân Tích 4 Tín Hiệu Tư Duy Sâu (4 Cognitive Depth Signals)

| Tín Hiệu Tư Duy | Phân Tích Trong Ngữ Cảnh Zalo Web Automation (24/7) | Ràng Buộc Áp Đặt Lên Framework & Toolchain |
| :--- | :--- | :--- |
| **S1: Không gian Phủ định (Negation Density)** | 1. CẤM gọi API ngầm (`zca-js`, `zlapi`) gây khóa tài khoản.<br>2. CẤM vi phạm CSP của [Chrome Extension Manifest V3](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts) (không `eval`, không inline script).<br>3. CẤM rò rỉ CSS giữa trang `chat.zalo.me` và Floating Panel.<br>4. CẤM thực thi song song các thao tác UI (bắt buộc qua Mutex Lock FIFO). | - Bundler phải xuất mã sạch 100% chuẩn MV3 CSP.<br>- Hỗ trợ tạo Shadow DOM (`attachShadow`) gốc kèm cơ chế cô lập CSS (`cssInjectionMode: 'ui'`).<br>- Không tự ý chèn runtime polyfill nặng làm đụng độ React 18 của Zalo. |
| **S2: Truy vấn Ngược (Reverse Probing — Điểm gãy)** | *Điều gì sẽ khiến hệ thống sập sau 12 giờ chạy liên tục hoặc khi Zalo cập nhật giao diện?*<br>1. Extension được update hoặc reload làm văng lỗi `Extension context invalidated` ở các `setInterval` / `MutationObserver` đang chạy.<br>2. Đơn vị `rem` của [Tailwind CSS](https://tailwindcss.com/) trong Shadow DOM bị biến dạng theo thẻ `<html>` của Zalo.<br>3. Đứt kết nối Keep-Alive giữa Content Script và Service Worker. | - Framework phải có cơ chế quản lý vòng đời ngữ cảnh (`ContentScriptContext`) tự động hủy timer/observer khi extension reload.<br>- Cần truyền thông điệp kiểu tĩnh (Type-safe Messaging) cho cả One-time Message và Long-lived Port.<br>- Cần bộ công cụ kiểm thử giả lập DOM + IndexedDB để phát hiện lỗi sớm khi Zalo đổi cấu trúc thẻ. |
| **S3: Tác động Đa bên (Multi-Stakeholder)** | **Lập trình viên & Vận hành cá nhân (Solo Builder/Operator)**:<br>- Vừa là người phát triển, vừa là người giám sát vận hành 24/7.<br>- Không có đội ngũ DevOps hay QA riêng; nếu cấu hình build phức tạp hoặc khó debug khi kẹt hàng chờ, chi phí bảo trì sẽ vượt quá sức chịu đựng cá nhân. | - Tối ưu hóa Developer Experience (DX): Cold start `< 500ms`, tự động reload Service Worker và Content Script.<br>- Linter/Formatter tốc độ cao, cấu hình 1 file duy nhất.<br>- Có giao diện trực quan hóa cơ sở dữ liệu và kịch bản E2E test tự động hóa. |
| **S4: Ràng buộc Vật lý & Tài nguyên (Constraint Anchoring)** | - Chạy liên tục 24/7 trên 1 tab Chromium (`chat.zalo.me`) vốn đã ngốn 400MB–800MB RAM do Virtualized DOM.<br>- Lưu trữ hàng chục nghìn bản ghi `entities` và `system_logs` trong vòng 30 ngày. | - **Radical Parsimony (Tinh gọn triệt để)**: UI của Floating Panel và Options Page phải dùng thư viện siêu nhẹ ([Preact](https://preactjs.com/) `~3kB` thay vì React `~40kB+`).<br>- Tận dụng [Dexie.js](https://dexie.org/) trên IndexedDB với truy vấn chỉ mục `< 2ms`. |

## 2. Đánh Giá & Chấm Điểm Các Ứng Viên Framework Chính (Evaluation Matrix)

Bốn ứng viên hàng đầu trong hệ sinh thái phát triển Web Extension hiện đại được đưa vào thẩm định gồm:
1. **[WXT (Next-gen Web Extension Framework)](https://wxt.dev/)**: Nền tảng xây dựng Extension thế hệ mới dựa trên [Vite](https://vite.dev/), lấy cảm hứng từ kiến trúc module và auto-import của Nuxt.
2. **[Plasmo Framework](https://docs.plasmo.com/framework)**: Framework phát triển Extension hướng đối tượng React-first, sử dụng Parcel bundler.
3. **[CRXJS Vite Plugin](https://www.npmjs.com/package/@crxjs/vite-plugin)**: Plugin tích hợp trực tiếp vào cấu hình Vite để biên dịch `manifest.json`.
4. **[Extension.js](https://extension.js.org/docs/migrate/from-crxjs)**: Công cụ đóng gói Extension không cần cấu hình (zero-config) dựa trên Rspack/Webpack.

### 2.1. Bảng Chấm Điểm Định Lượng Theo 5 Nhóm Tiêu Chí (Thang điểm 1–5)

| Mã Tiêu Chí | Tiêu Chí Đánh Giá (Trọng Số) | [WXT](https://wxt.dev/) | [Plasmo](https://docs.plasmo.com/framework) | [CRXJS](https://www.npmjs.com/package/@crxjs/vite-plugin) | [Extension.js](https://extension.js.org/docs/migrate/from-crxjs) | Phân Tích Kỹ Thuật & Bằng Chứng Kiểm Chứng |
| :--- | :--- | :---: | :---: | :---: | :---: | :--- |
| **C1.1** | Hỗ trợ Native Manifest V3 | **5.0** | 4.5 | 4.0 | 4.5 | [WXT](https://wxt.dev/) tự sinh `manifest.json` chuẩn MV3 từ file-based entrypoints và kiểm tra chặt chẽ quyền hạn khi build. |
| **C1.2** | Tuân thủ CSP (Zero `eval`) | **5.0** | 4.5 | 4.0 | 4.0 | Bản build của [WXT](https://wxt.dev/) và [Plasmo](https://docs.plasmo.com/framework) hoàn toàn sạch inline script; CRXJS đôi khi gặp lỗi CSP ở chế độ dev với Vite 8 ([CRXJS Issue #1146](https://github.com/crxjs/chrome-extension-tools/discussions/1146)). |
| **C1.3** | Cô lập 4 Ngữ cảnh (Context Routing) | **5.0** | 4.5 | 4.0 | 4.0 | [WXT Content Scripts](https://wxt.dev/guide/essentials/content-scripts) tách biệt hoàn toàn `background.ts`, `*.content.ts`, `options/` và `unlisted` scripts (Main world). |
| *Nhóm 1* | **Điểm Trung Bình Nhóm 1 (25%)** | **5.00** | **4.50** | **4.00** | **4.17** | **WXT dẫn đầu tuyệt đối về độ chuẩn hóa MV3.** |
| **C2.1** | Cô lập CSS qua Shadow DOM | **5.0** | **5.0** | 2.5 | 3.0 | [WXT Content Scripts](https://wxt.dev/guide/essentials/content-scripts) cung cấp sẵn `createShadowRootUi(ctx, { cssInjectionMode: 'ui', isolateEvents: true })`; [Plasmo CSUI](https://docs.plasmo.com/framework/content-scripts-ui) cũng hỗ trợ tự động nhưng khóa chặt vào lifecycle riêng; CRXJS phải tự viết thủ công. |
| **C2.2** | Tương thích [Dexie.js](https://dexie.org/) ở Content Script | **5.0** | 4.0 | 4.5 | 4.0 | [WXT](https://wxt.dev/) dùng [Vite](https://vite.dev/) / Rollup chuẩn nên phân giải ESM của [Dexie.js](https://dexie.org/docs) mượt mà, không gặp lỗi Parcel resolver như Plasmo. |
| **C2.3** | Chuyển đổi Isolated vs Main World | **5.0** | 4.0 | 3.5 | 3.5 | [WXT Content Scripts](https://wxt.dev/guide/essentials/content-scripts) hỗ trợ cả `world: 'MAIN'` lẫn hàm `injectScript('/main-world.js')` đồng bộ cho MV3, kèm sẵn đối tượng `ctx` chống lỗi `Extension context invalidated`. |
| *Nhóm 2* | **Điểm Trung Bình Nhóm 2 (25%)** | **5.00** | **4.33** | **3.50** | **3.50** | **Cơ chế `ctx` + `createShadowRootUi` của WXT giải quyết trọn vẹn bài toán Zalo DOM.** |
| **C3.1** | Cơ chế Hot Reload Content Script | **4.5** | 4.0 | 4.5 | 4.0 | [WXT](https://wxt.dev/) tự động reload riêng lẻ từng Content Script trên tab `chat.zalo.me` mà không bắt F5 toàn trang, giữ nguyên phiên đăng nhập Zalo. |
| **C3.2** | Tự động Reload Background SW | **5.0** | 4.5 | 4.0 | 4.0 | [WXT](https://wxt.dev/) tự động hủy và nạp lại Service Worker ngay khi lưu file `background.ts`. |
| **C3.3** | Tốc độ Build / Dev Server (`<500ms`) | **5.0** | 3.0 | 4.5 | 4.5 | [WXT](https://wxt.dev/) chạy trên nền [Vite](https://vite.dev/) cho tốc độ rebuild `< 150ms`; trong khi [Plasmo](https://docs.plasmo.com/framework) dùng Parcel khá nặng và khởi động chậm hơn. |
| *Nhóm 3* | **Điểm Trung Bình Nhóm 3 (20%)** | **4.83** | **3.83** | **4.33** | **4.17** | **Nền tảng Vite giúp WXT đạt tốc độ phản hồi tức thì khi debug DOM.** |
| **C4.1** | TypeScript First-Class & Path Aliases | **5.0** | 4.5 | 4.0 | 4.0 | [WXT](https://wxt.dev/) tự động cấu hình `@/` alias và sinh `.wxt/tsconfig.json` chuẩn Strict Mode. |
| **C4.2** | Type-Safe Message Passing | **5.0** | 4.5 | 3.0 | 3.0 | Hệ sinh thái [WXT Messaging](https://wxt.dev/guide/essentials/messaging) kết hợp hoàn hảo với [`@webext-core/messaging`](https://webext-core.aklinker1.io/messaging/installation) và [`@webext-core/proxy-service`](https://www.npmjs.com/package/%40webext-core%2Fproxy-service) do cùng tác giả phát triển. |
| **C4.3** | Auto-generated Manifest Types | **5.0** | 3.5 | 4.5 | 3.5 | File `wxt.config.ts` kiểm tra kiểu tĩnh toàn bộ trường `permissions`, `host_permissions` và đường dẫn entrypoint. |
| *Nhóm 4* | **Điểm Trung Bình Nhóm 4 (15%)** | **5.00** | **4.17** | **3.83** | **3.50** | **Đạt độ an toàn kiểu dữ liệu tuyệt đối từ cấu hình đến runtime.** |
| **C5.1** | Kích thước Bundle gọn nhẹ (Zero Bloat) | **5.0** | 3.0 | 4.5 | 4.0 | [WXT](https://wxt.dev/) không ép buộc nạp React runtime vào Content Script nếu dùng Vanilla TS hoặc [Preact](https://preactjs.com/). |
| **C5.2** | Không bị Vendor Lock-in | **4.5** | 2.5 | 4.5 | 4.0 | Code trong [WXT](https://wxt.dev/) là chuẩn Vite/TS thuần túy; dễ dàng tháo gỡ sang Rollup/Vite gốc nếu cần, trong khi [Plasmo](https://docs.plasmo.com/quickstarts/migrate-to-plasmo) khóa chặt vào quy ước riêng. |
| **C5.3** | Tự do chọn UI Framework | **5.0** | 3.5 | 4.5 | 4.5 | [WXT Content Scripts](https://wxt.dev/guide/essentials/content-scripts) hỗ trợ chính thức Vanilla TS, [Preact](https://preactjs.com/), React, Vue, Svelte, Solid. |
| *Nhóm 5* | **Điểm Trung Bình Nhóm 5 (15%)** | **4.83** | **3.00** | **4.50** | **4.17** | **Đáp ứng triết lý Radical Parsimony (Tinh gọn, không lệ thuộc).** |
| **TỔNG** | **TỔNG ĐIỂM TRỌNG SỐ (Thang 5.0)** | **4.94 / 5.0** | **4.06 / 5.0** | **4.00 / 5.0** | **3.90 / 5.0** | **QUYẾT ĐỊNH: CHỌN WXT (`wxt.dev`) LÀM FRAMEWORK CHÍNH.** |

## 3. Quyết Định Kiến Trúc Cốt Lõi (ADR-001: Lý Do Chọn WXT Framework)

Dựa trên điểm số áp đảo **4.94 / 5.0**, **[WXT Framework](https://wxt.dev/)** được chọn làm nền tảng xây dựng chính cho dự án Zalo Personal Automation (24/7) vì **4 lợi thế kỹ thuật giải quyết trực tiếp bài toán nghiệp vụ**:

1. **Giải quyết triệt để lỗi "Extension Context Invalidated" khi chạy 24/7**:
   - Trong [WXT Content Scripts](https://wxt.dev/guide/essentials/content-scripts), hàm `main(ctx)` cung cấp đối tượng `ctx` (`ContentScriptContext`). Khi sử dụng `ctx.setInterval()`, `ctx.setTimeout()`, hoặc `ctx.addEventListener()`, WXT sẽ tự động thu hồi toàn bộ các bộ đếm và trình lắng nghe ngay khi Extension được cập nhật hoặc khởi động lại, ngăn chặn tình trạng rò rỉ bộ nhớ (memory leak) hoặc xung đột 2 Worker chạy song song trên cùng 1 tab Zalo.
2. **Hàm `createShadowRootUi` tích hợp sẵn cơ chế cô lập sự kiện và CSS**:
   - Chỉ với cấu hình `cssInjectionMode: 'ui'` và `createShadowRootUi(ctx, { name: 'zalo-automation-panel', position: 'overlay', isolateEvents: ['keydown', 'keyup', 'keypress'] })`, toàn bộ thao tác gõ phím hoặc click trên Floating Panel của Extension sẽ không bị lọt xuống các phím tắt của trang Zalo Web bên dưới.
   - Đồng thời, WXT cung cấp giải pháp xử lý triệt để vấn đề lệch tỷ lệ đơn vị `rem` của [Tailwind CSS](https://tailwindcss.com/) bên trong Shadow DOM ([WXT Content Scripts Guide](https://wxt.dev/guide/essentials/content-scripts)).
3. **Hỗ trợ ` autoMount` cho DOM động của SPA React 18**:
   - Zalo Web là ứng dụng Single Page Application (SPA) thường xuyên hủy và tạo lại các vùng chứa DOM khi chuyển đổi màn hình đăng nhập và màn hình chat. API `ui.autoMount()` của [WXT](https://wxt.dev/guide/essentials/content-scripts) tự động theo dõi thẻ neo (`anchor`) và gắn lại Floating Widget nếu Zalo render lại giao diện.
4. **Cơ chế File-based Entrypoints sạch sẽ, tách biệt rõ ràng**:
   - Thư mục `entrypoints/background.ts`, `entrypoints/zalo.content/index.tsx`, và `entrypoints/options/index.html` được biên dịch thành các bundle độc lập hoàn toàn, tuân thủ 100% tiêu chí `C1.3`.

## 4. Hệ Sinh Thái Công Nghệ & Công Cụ Hỗ Trợ Toàn Diện (Full Lifecycle Toolchain)

Để một nhà phát triển cá nhân (Solo Developer) có thể tích hợp phát triển, xây dựng, debug, bảo trì và mở rộng hệ thống 10 Node một cách nhẹ nhàng nhất, bộ công cụ đi kèm được chuẩn hóa theo từng giai đoạn vòng đời:

### 4.1. Bảng Tổng Hợp Toolchain Theo Vòng Đời Phát Triển

| Giai Đoạn / Vai Trò | Công Nghệ / Thư Viện Đề Xuất | Ràng Buộc Nghiệp Vụ Được Giải Quyết (Traceability) | Cách Tích Hợp Trong Kiến Trúc WXT |
| :--- | :--- | :--- | :--- |
| **1. Core Build & Bundler** | **[WXT](https://wxt.dev/)** + **[Vite](https://vite.dev/)** + **[TypeScript](https://www.typescriptlang.org/)** (Strict Mode) | Đáp ứng nhóm tiêu chí **C1, C3, C4**: Khởi động dev server tức thì, tự sinh `manifest.json` chuẩn MV3, kiểm tra kiểu dữ liệu tĩnh toàn cục. | Khởi tạo qua `npx wxt@latest init` với cấu hình `strict: true` và Path Alias `@/*`. |
| **2. UI Layer (Floating Panel & Options)** | **[Preact](https://preactjs.com/)** (`~3kB`) + **[Preact Signals](https://preactjs.com/guide/v10/signals/)** + **[Tailwind CSS](https://tailwindcss.com/)** | Đáp ứng nhóm tiêu chí **C2.1, C5.1, C5.3**: Giữ kích thước bundle Content Script siêu nhỏ, không gây nặng tab Zalo đang chạy React 18; Signals giúp cập nhật trạng thái `Queue Count` và `Worker Status` tức thì mà không re-render toàn cây UI. | Cài đặt `@wxt-dev/module-react` hoặc cấu hình Preact preset trong `wxt.config.ts`; nhúng CSS vào Shadow Root qua `cssInjectionMode: 'ui'`. |
| **3. Local Database & Storage** | **[Dexie.js](https://dexie.org/)** (`v4+`) + **[`@wxt-dev/storage`](https://wxt.dev/)** | Đáp ứng **Node 2, Node 4, Node 6**: Lưu trữ bền bỉ hàng chờ `group_dispatch_queue`, mốc nối `group_checkpoints` và khử trùng lặp 30 ngày (`entities`) trên IndexedDB của `chat.zalo.me`; đồng bộ Whitelist từ Options Page qua `chrome.storage.local`. | Khai báo `ZaloAutomationDatabase` bằng [Dexie.js](https://dexie.org/docs) tại `@/core/db/schema.ts`; dùng `storage.defineItem` của WXT cho cấu hình Whitelist. |
| **4. Cross-Context Messaging & Keep-Alive** | **[`@webext-core/messaging`](https://webext-core.aklinker1.io/messaging/installation)** + Native `chrome.runtime.Port` Wrapper | Đáp ứng **Tiêu chí C4.2** & **Keep-Awake 24/7**: Định kiểu dữ liệu chặt chẽ (Type-safe Data Contracts) cho toàn bộ thông điệp giữa Content Script, Background Worker và Options UI; duy trì Heartbeat 20s qua Port. | Định nghĩa `ProtocolMap` chung tại `@/contracts/messaging.ts`. |
| **5. Runtime Validation & Parsing** | **[Zod](https://zod.dev/)** | Đáp ứng **Node 5, Node 6, Node 7** & nguyên tắc **Des-2 (Data Contract Lock)**: Kiểm tra tính hợp lệ của dữ liệu cấu hình Import/Export (Whitelist, Price Range Rules) và chuẩn hóa đầu ra của bộ bóc tách khoảng giá/số điện thoại. | Đặt các schema kiểm duyệt tại `@/contracts/schemas.ts`. |
| **6. Code Quality, Linting & Formatting** | **[Biome](https://biomejs.dev/linter/)** | Đáp ứng nguyên tắc **Stage 5 Build Quality Gate**: Thay thế cả ESLint và Prettier bằng một công cụ viết bằng Rust duy nhất, chạy nhanh gấp 25 lần ([Why Biome](https://biomejs.dev/introduction/why-biome/)), chặn lỗi biến thừa và bất đồng bộ. | Cấu hình 1 file `biome.json` ở thư mục gốc, tích hợp lệnh `biome check --write .` vào Git pre-commit hook. |
| **7. Unit & Integration Testing (Logic & DB)** | **[Vitest](https://github.com/vitest-dev/vitest/discussions/908)** + **[`fake-indexeddb`](https://github.com/dumbmatter/fakeIndexedDB)** + `happy-dom` | Đáp ứng **GATE-03 (Khử trùng 30 ngày)** & **Node 4, 5, 6, 7**: Cho phép test độc lập toàn bộ thuật toán gom cụm 15s, bóc tách SĐT lách luật (`O9O.123.4567`), định tuyến khoảng giá và truy vấn [Dexie.js](https://dexie.org/) ngay trên bộ nhớ RAM trong `< 1 giây` mà không cần mở trình duyệt. | Cấu hình `setupFiles: ['fake-indexeddb/auto']` trong `vitest.config.ts` để test trực tiếp class `ZaloAutomationDatabase`. |
| **8. End-to-End (E2E) Extension Testing** | **[Playwright](https://playwright.dev/docs/chrome-extensions)** (Chromium Persistent Context) | Đáp ứng **GATE-01 đến GATE-07**: Tự động nạp bản build Extension vào Chromium thật qua `chromium.launchPersistentContext()`, kiểm thử khả năng inject Shadow DOM, mô phỏng trang Zalo giả lập (Mock Zalo DOM Fixture) để test luồng Chuyển tiếp 2 Pha và phục hồi sau khi nhấn F5. | Viết kịch bản E2E tại `tests/e2e/` sử dụng API [Playwright Chrome Extensions](https://playwright.dev/docs/chrome-extensions). |
| **9. Debugging & Observability (24/7)** | **Structured Ring-Buffer Logger** (trên [Dexie.js](https://dexie.org/)) + **Selector Health Check** | Đáp ứng **Ma trận Phòng vệ EX-01 đến EX-07**: Ghi nhật ký có cấu trúc vào bảng `system_logs` (tự động xóa cuốn chiếu bản ghi quá 7–30 ngày để chống tràn ổ cứng), hiển thị trực tiếp trên tab "Nhật ký & Chẩn đoán" của Options Page, kèm công cụ xuất file `.json` khi cần debug lỗi kẹt Modal. | Xây dựng module `@/core/observability/logger.ts` và bộ kiểm tra `SelectorHealthChecker` tự phát hiện khi Zalo đổi tên class CSS. |

## 5. Kiến Trúc Thư Mục Chuẩn Hóa Cho Dự Án (Recommended Project Structure)

Cấu trúc thư mục dưới đây được thiết kế theo nguyên tắc **Tách biệt Giao diện, Điều phối và Nghiệp vụ lõi (Clean Modular Architecture)**, ánh xạ 1-1 với **10 Node chức năng** trong tài liệu đặc tả:

```text
zalo-personal-automation/
├── entrypoints/
│   ├── background.ts                 # SW: Keep-Awake Port (20s), chrome.power, Watchdog 60s
│   ├── zalo.content/                 # Content Script chính chạy trên https://chat.zalo.me/*
│   │   ├── index.tsx                 # Khởi tạo WXT ContentScriptContext (ctx), gắn ShadowRoot UI
│   │   ├── style.css                 # Tailwind CSS cô lập hoàn toàn trong Shadow DOM
│   │   └── FloatingPanel.tsx         # Giao diện nổi góc phải: Trạng thái, Queue Count, Nút Emergency Stop
│   └── options/                      # Giao diện Quản trị & Cấu hình (Options Page)
│       ├── index.html
│       ├── main.tsx                  # Quản lý Whitelist, Bảng Khoảng Giá (Price Map), Xem System Logs
│       └── style.css
├── src/
│   ├── contracts/                    # KHÓA CHẶT HỢP ĐỒNG DỮ LIỆU (Stage 3 Data Contracts)
│   │   ├── schemas.ts                # Zod schemas: EntityBundle, GroupCheckpoint, PriceRouteRule
│   │   ├── messaging.ts              # @webext-core/messaging protocol map (Type-safe IPC)
│   │   └── selectors.ts              # Tập trung toàn bộ DOM Selectors của Zalo Web (dễ bảo trì khi Zalo update)
│   ├── db/                           # TẦNG LƯU TRỮ CỤC BỘ (Dexie.js IndexedDB)
│   │   ├── database.ts               # Khai báo ZaloAutomationDatabase (5 bảng chuẩn spec)
│   │   ├── queue-repo.ts             # CRUD cho group_dispatch_queue + Persistent Recovery
│   │   ├── dedup-repo.ts             # Truy vấn khử trùng 2 lớp (entityKey & contentHash) + Rolling 30d TTL
│   │   └── log-repo.ts               # Ghi và xoay vòng (Ring-buffer) bảng system_logs
│   ├── nodes/                        # 10 NODE NGHIỆP VỤ ĐỘC LẬP (5 Tầng Kiến Trúc)
│   │   ├── n01-sidebar-observer.ts   # MutationObserver bất đồng bộ trên #conversationList
│   │   ├── n02-queue-manager.ts      # Điều phối FIFO + Mutex Lock + Phục hồi sau F5
│   │   ├── n03-chat-switcher.ts      # Mở nhóm nguồn + Strict Bottom Anchor (bỏ qua nút 99+)
│   │   ├── n04-delta-stitcher.ts     # Tìm điểm nối Checkpoint hoặc Fallback 5-10 tin đáy
│   │   ├── n05-bundle-aggregator.ts  # Gom cụm Media + Text theo senderId (cửa sổ 15s, debounce 2-3s)
│   │   ├── n06-dedup-gate.ts         # Thẩm định cấu trúc + Kiểm tra trùng 2 lớp 30 ngày
│   │   ├── n07-price-router.ts       # Bóc tách SĐT/Giá + Ánh xạ tối đa <= 2 Nhóm Con
│   │   ├── n08-forward-automator.ts  # Pha 1: Mở Native Forward Modal -> Chọn nhóm -> Chờ Toast thành công
│   │   ├── n09-text-injector.ts      # Pha 2 & 3: Chuyển Nhóm Con gõ editedText -> Micro-Jitter -> Về Nhóm Nguồn
│   │   └── n10-committer-drain.ts    # Đệm tĩnh lặng 10s Inactivity -> Ghi Checkpoint -> Mở khóa Queue
│   └── utils/
│       ├── react-dom-bridge.ts       # setReactInputValue(), dispatchEvent() tương thích React 18
│       ├── pacing-guard.ts           # randomJitter(1000, 2000) & Circuit Breaker khi gặp Captcha
│       └── crypto-hash.ts            # Băm SHA-256 chuẩn Web Crypto API (crypto.subtle.digest)
├── tests/
│   ├── unit/                         # Vitest + fake-indexeddb (Test N4, N5, N6, N7 trong <1s)
│   └── e2e/                          # Playwright Chromium Extension Tests + Mock Zalo DOM HTML
├── biome.json                        # Cấu hình Linter & Formatter duy nhất
├── wxt.config.ts                     # Cấu hình Manifest V3, Permissions, Auto-imports
├── tsconfig.json                     # Cấu hình TypeScript Strict Mode
└── package.json
```

## 6. Chiến Lược Debug, Bảo Trì & Mở Rộng Dài Hạn (Maintainability & Scalability Strategy)

### 6.1. Cơ Chế Chống Gãy Khi Zalo Cập Nhật Giao Diện (Anti-Fragile Selector Registry)
Rủi ro bảo trì lớn nhất của mọi công cụ tự động hóa DOM là việc trang đích (`chat.zalo.me`) thay đổi tên class CSS sau các đợt cập nhật. Để bảo trì nhanh trong vòng 5 phút:
- **Tuyệt đối không hardcode selector rải rác trong 10 Node**: Toàn bộ selector phải được gom về một file duy nhất `src/contracts/selectors.ts` với cơ chế **Fallback Đa Tầng (Multi-tier Selector Fallback)**:
  1. *Ưu tiên 1*: Dựa trên thuộc tính ngữ nghĩa ổn định của Zalo như `[data-translate-inner="STR_SHARE"]`, `[data-id="..."]`, hoặc `role="dialog"`.
  2. *Ưu tiên 2*: Dựa trên cấu trúc DOM tương đối và văn bản hiển thị (ví dụ: tìm thông báo Toast chứa chuỗi `"Đã chia sẻ"`).
  3. *Ưu tiên 3*: Class CSS cụ thể (`.toast-content`, `#conversationList`).
- **Tích hợp hàm `runSelectorDiagnostic()`**: Khi khởi động Extension trên tab Zalo, hệ thống kiểm tra nhanh các vùng chứa cốt lõi (Sidebar, Khung chat, Ô nhập liệu). Nếu Zalo cập nhật giao diện làm mất selector, Floating Panel sẽ báo đèn vàng `SELECTOR_OUTDATED` kèm tên phần tử bị thiếu để bạn cập nhật ngay trong `selectors.ts` và hưởng lợi từ cơ chế HMR của [WXT](https://wxt.dev/).

### 6.2. Chiến Lược Kiểm Thử "Giả Lập DOM Zalo" (Offline DOM Fixture Testing)
Không bao giờ dùng tài khoản Zalo thật để chạy thử nghiệm các vòng lặp phát triển thô (vì dễ kích hoạt cơ chế chống spam của VNG khi code còn lỗi):
- Lưu lại 2–3 mẫu HTML tĩnh (Snapshots) của trang Zalo Web (gồm Sidebar, Khung chat có Album ảnh + Text, và Modal Chia sẻ) vào thư mục `tests/e2e/fixtures/mock-zalo.html`.
- Dùng [Playwright](https://playwright.dev/docs/chrome-extensions) mở trang `mock-zalo.html` này để test toàn bộ luồng từ Node 1 đến Node 10 một cách an toàn 100%, tốc độ cao và hoàn toàn tự động trước khi chạy thật trên `chat.zalo.me`.

### 6.3. Lộ Trình Mở Rộng (Scalability Roadmap)
Khi nhu cầu cá nhân phát triển lên quy mô lớn hơn, kiến trúc [WXT](https://wxt.dev/) + [Dexie.js](https://dexie.org/) cho phép mở rộng mượt mà mà không cần đập đi xây lại:
1. **Giai đoạn 1 (Personal 24/7 MVP)**: Chạy 100% cục bộ trên trình duyệt cá nhân, khử trùng lặp qua IndexedDB, cấu hình trực tiếp trên Options Page.
2. **Giai đoạn 2 (Remote Alerting & Webhook)**: Bổ sung module bắn cảnh báo qua Telegram Bot / Webhook trong Background Service Worker khi `Circuit Breaker` kích hoạt (ví dụ khi Zalo đòi Captcha lúc bạn không ngồi trước máy tính).
3. **Giai đoạn 3 (Multi-Profile / Cloud Sync)**: Đồng bộ bảng `entities` (chống trùng lặp giữa nhiều tài khoản Zalo chạy trên các profile trình duyệt khác nhau) thông qua REST API nhẹ hoặc đồng bộ định kỳ từ Background Worker.

## 7. Cổng Kiểm Duyệt Chất Lượng Nhị Phân (Stage 3 Architecture Review Gate)

Đối chiếu với quy chuẩn của `@architect` (Stage 3 Assurance Checklist):

| Mã Gate | Tiêu Chí Kiểm Chứng Cơ Học | Trạng Thái | Bằng Chứng Giải Trình |
| :--- | :--- | :---: | :--- |
| **DES-1** | Xác định rõ Negative Space (Các điều hệ thống KHÔNG làm) | **PASS** | Đã khóa chặt 6 điều cấm (Không gọi API ngầm, không re-upload media, không bấm nút 99+, không chạy song song UI, không bỏ qua jitter, không nuốt lỗi). |
| **DES-2** | Khóa chặt Data Contract & Schema trước khi viết code | **PASS** | Đã định nghĩa đầy đủ 5 bảng [Dexie.js](https://dexie.org/) (`app_settings`, `group_checkpoints`, `group_dispatch_queue`, `entities`, `system_logs`) và hợp đồng `EntityBundle`. |
| **DES-3** | Quyết định công nghệ dựa trên ADR và liên kết ngược tới Constraint | **PASS** | Lựa chọn [WXT](https://wxt.dev/), [Preact](https://preactjs.com/), [Dexie.js](https://dexie.org/), [Vitest](https://github.com/vitest-dev/vitest/discussions/908), [Playwright](https://playwright.dev/docs/chrome-extensions), [Biome](https://biomejs.dev/linter/) đều bắt nguồn trực tiếp từ ma trận tiêu chí C1–C5 và 4 tín hiệu tư duy sâu. |
| **DES-4** | Domain Anchoring hoàn tất trước khi chọn Stack | **PASS** | Đã neo chặt vào ngữ cảnh vận hành Zalo Web 24/7 và luồng Chuyển tiếp 2 Pha trước khi chấm điểm công nghệ. |
