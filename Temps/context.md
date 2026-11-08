Để giúp bạn có cơ sở kỹ thuật vững chắc tự thẩm định, so sánh và lựa chọn nền tảng/framework phát triển Extension phù hợp nhất với dự án **Zalo Personal Automation (24/7)**, dưới đây là **Bộ Yêu Cầu & Hệ Tiêu Chí Đánh Giá Kỹ Thuật (Extension Toolchain Evaluation Matrix)** được xây dựng trực tiếp từ các ràng buộc vận hành khắt khe của dự án.

---

# BỘ TIÊU CHÍ ĐÁNH GIÁ & LỰA CHỌN FRAMEWORK PHÁT TRIỂN CHROME EXTENSION

Ngôn ngữ ưu tiên: **TypeScript / JavaScript**  
Kiến trúc đích: **Chromium Extension Manifest V3**  
Đặc thù dự án: **Heavy Content Script** (90% logic can thiệp DOM Zalo Web & Dexie.js), **Keep-Alive 24/7**, và **Injected Floating UI**.

---

## I. NHÓM TIÊU CHÍ 1: TƯƠNG THÍCH MANIFEST V3 & CHÍNH SÁCH BẢO MẬT (MV3 & CSP COMPLIANCE)

*Trọng số: 25% — Tiêu chí sinh tử (Hard Constraint)*

| Mã | Tên Tiêu Chí | Mô Tả & Ràng Buộc Của Dự Án | Cách Kiểm Chứng (Verification Method) |
| :--- | :--- | :--- | :--- |
| **C1.1** | **Hỗ trợ Native Manifest V3** | Nền tảng phải tự động sinh file `manifest.json` theo chuẩn MV3 (sử dụng `service_worker` cho background thay vì `scripts` nền của MV2). | Kiểm tra output build xem có khai báo `background.service_worker` hợp lệ không. |
| **C1.2** | **Không vi phạm CSP (Content Security Policy)** | Chrome MV3 **cấm tuyệt đối** việc sử dụng `eval()`, `new Function()`, và script nội tuyến (inline scripts) trong extension pages. Nền tảng khi build production không được chèn code vi phạm CSP. | Chạy thử extension trên Chrome Canary/Brave; kiểm tra Console xem có cảnh báo vi phạm CSP không. |
| **C1.3** | **Quản lý đa ngữ cảnh (Context Routing)** | Phân tách rạch ròi quá trình biên dịch (bundle) cho 4 ngữ cảnh độc lập: Background Worker, Content Script, Options Page, và Injected Script. Không bị rò rỉ mã nguồn từ ngữ cảnh này sang ngữ cảnh khác. | Kiểm tra các file đầu ra trong thư mục `dist/`: mỗi entry point phải là một bundle cô lập. |

---

## II. NHÓM TIÊU CHÍ 2: NĂNG LỰC HỖ TRỢ CONTENT SCRIPT & INJECTED UI

*Trọng số: 25% — Trọng tâm nghiệp vụ của dự án*

Dự án này có **90% nghiệp vụ chạy trong Content Script** (can thiệp DOM React 18 của Zalo và render Floating Control Panel).

| Mã | Tên Tiêu Chí | Mô Tả & Ràng Buộc Của Dự Án | Cách Kiểm Chứng (Verification Method) |
| :--- | :--- | :--- | :--- |
| **C2.1** | **Cô lập CSS qua Shadow DOM (UI Style Isolation)** | Thanh điều khiển nổi (Floating Widget) được chèn trực tiếp vào trang `chat.zalo.me`. Framework phải hỗ trợ inject component kèm style vào **Shadow DOM** để CSS của Zalo không làm vỡ UI Extension và CSS Extension không ảnh hưởng Zalo. | Thử tạo 1 component UI nổi; kiểm tra xem framework có hỗ trợ tự động bọc trong Shadow Root (`attachShadow({ mode: 'open' })`) hay không. |
| **C2.2** | **Tương thích IndexedDB (Dexie.js) tại Content Script** | Dexie.js và Web Workers phải hoạt động mượt mà trong ngữ cảnh Content Script mà không gặp lỗi phân giải module (Module resolution) hay thiếu polyfill của trình duyệt. | Import Dexie vào Content Script, mở DB và thực hiện thao tác CRUD cơ bản trên `chat.zalo.me`. |
| **C2.3** | **Tách biệt Execution Worlds (Isolated vs Main World)** | Dự án cần chạy mặc định trong `ISOLATED world`, nhưng khi cần có thể linh hoạt inject script vào `MAIN world` để can thiệp React Fiber props. Nền tảng phải hỗ trợ cấu hình `world: "MAIN" | "ISOLATED"` dễ dàng. | Kiểm tra cấu hình entrypoint content script có cho phép khai báo thuộc tính `world` theo chuẩn MV3 không. |

---

## III. NHÓM TIÊU CHÍ 3: TRẢI NGHIỆM PHÁT TRIỂN & CƠ CHẾ HOT RELOAD (DEVELOPER EXPERIENCE & HMR)

*Trọng số: 20% — Ảnh hưởng trực tiếp đến tốc độ và độ tin cậy khi debug*

Lập trình Extension có đặc thù rất khó chịu: mỗi lần sửa code Content Script thường phải F5 lại trang web mục tiêu hoặc reload lại extension.

| Mã | Tên Tiêu Chí | Mô Tả & Ràng Buộc Của Dự Án | Cách Kiểm Chứng (Verification Method) |
| :--- | :--- | :--- | :--- |
| **C3.1** | **Hot Module Replacement (HMR) cho Content Script** | Khi chỉnh sửa code trong Content Script, framework phải tự động cập nhật code mới vào tab `chat.zalo.me` đang mở mà không làm mất trạng thái đăng nhập hoặc bắt buộc phải reload extension thủ công. | Sửa 1 dòng log trong Content Script; kiểm tra xem trang Zalo Web có tự nhận log mới mà không cần F5 trình duyệt không. |
| **C3.2** | **Tự động Reload Background Service Worker** | Khi sửa logic trong Background Worker (cơ chế Keep-Alive, Alarms), framework phải tự động hủy worker cũ và kích hoạt worker mới ngay lập tức. | Sửa file background; xem cờ reload trên giao diện `chrome://extensions` có tự nhảy không. |
| **C3.3** | **Tốc độ Build / Dev Server** | Ưu tiên các nền tảng sử dụng engine build hiện đại (như **Vite / Rollup / esbuild**) thay vì các cấu hình Webpack cũ kỹ, cồng kềnh, thời gian khởi động lâu. | Đo thời gian `cold start` và thời gian rebuild khi save code (yêu cầu `< 500ms`). |

---

## IV. NHÓM TIÊU CHÍ 4: HỖ TRỢ TYPESCRIPT & TYPE SAFETY ĐA TIẾN TRÌNH

*Trọng số: 15% — Bảo đảm tính ổn định kiến trúc*

| Mã | Tên Tiêu Chí | Mô Tả & Ràng Buộc Của Dự Án | Cách Kiểm Chứng (Verification Method) |
| :--- | :--- | :--- | :--- |
| **C4.1** | **TypeScript First-Class Support** | Hỗ trợ cấu hình TypeScript (`tsconfig.json`) nghiêm ngặt (Strict Mode), hỗ trợ Path Aliases (`@/core`, `@/storage`, `@/ui`) mà không cần cấu hình plugin phức tạp. | Tạo file `.ts`, khai báo type phức tạp và alias import; kiểm tra xem build có báo lỗi type chuẩn xác không. |
| **C4.2** | **Type-Safe Message Passing (Truyền thông điệp có kiểu)** | Giao tiếp giữa Content Script, Background Worker và Options Page qua `chrome.runtime.sendMessage` hoặc `Port` rất dễ lỗi typo. Nền tảng có hỗ trợ sẵn hoặc dễ dàng tích hợp bộ định kiểu dữ liệu (Data Contract types) cho các message không? | Đánh giá mức độ thuận tiện khi viết một wrapper gửi nhận message có kiểm tra kiểu dữ liệu tĩnh. |
| **C4.3** | **Auto-generated Manifest Types** | Type checking cho chính file cấu hình extension (Permissions, Host Permissions, Web Accessible Resources) để tránh sai sót cú pháp Manifest. | Đánh giá xem file config của framework có gợi ý code (IntelliSense) cho các quyền của Chrome API không. |

---

## V. NHÓM TIÊU CHÍ 5: TÍNH TINH GỌN & KHÔNG GÂY LỆ THUỘC (PARSIMONY & ARCHITECTURAL FREEDOM)

*Trọng số: 15% — Triết lý Andrew Principles (Radical Parsimony)*

| Mã | Tên Tiêu Chí | Mô Tả & Ràng Buộc Của Dự Án | Cách Kiểm Chứng (Verification Method) |
| :--- | :--- | :--- | :--- |
| **C5.1** | **Kích thước Bundle gọn nhẹ (Zero Bloat)** | Mã nguồn được build ra không bị chèn các thư viện runtime thừa thãi từ framework, giữ dung lượng nhỏ và hạn chế tối đa độ trễ nạp script trên trang Zalo. | Kiểm tra dung lượng thư mục `dist/` sau khi build production cho một file `content.ts` trống. |
| **C5.2** | **Không bị Vendor Lock-in (Tính độc lập cao)** | Cấu trúc code có dễ dàng di chuyển (migrate) sang một bundler khác (như Vite thuần hoặc Webpack thuần) nếu framework ngừng bảo trì trong tương lai không? | Xem code nghiệp vụ có bị phụ thuộc vào các decorator/hàm đặc thù chỉ framework đó mới có hay không. |
| **C5.3** | **Tính tự do chọn UI Framework cho Options/Popup** | Nền tảng có cho phép tự do chọn công nghệ render UI (React, Vue, Svelte, hoặc Vanilla TS/HTML) cho trang Options/Popup mà không ép buộc một hệ sinh thái duy nhất không? | Kiểm tra tài liệu hỗ trợ đa framework UI của nền tảng. |

---

## BẢNG TỔNG HỢP TRỌNG SỐ CHẤM ĐIỂM (EVALUATION SCORECARD)

Bạn có thể sử dụng thang điểm từ **1 đến 5** cho từng tiêu chí để chấm điểm các ứng viên tiềm năng mà bạn tìm được:

```
Tổng Điểm = (Điểm Nhóm 1 × 0.25) + (Điểm Nhóm 2 × 0.25) + (Điểm Nhóm 3 × 0.20) + (Điểm Nhóm 4 × 0.15) + (Điểm Nhóm 5 × 0.15)
```

| Nhóm Tiêu Chí | Trọng Số | Yêu Cầu Cốt Lõi Cho Dự Án Zalo Automation |
| :--- | :---: | :--- |
| **Nhóm 1: MV3 & CSP Compliance** | **25%** | Tự sinh `manifest.json` chuẩn MV3, không vi phạm CSP, cô lập 4 ngữ cảnh. |
| **Nhóm 2: Content Script & Injected UI** | **25%** | Hỗ trợ Shadow DOM cho Floating Widget, tương thích Dexie.js, hỗ trợ Isolated/Main world. |
| **Nhóm 3: DX & Hot Reload (HMR)** | **20%** | HMR mượt trên Content Script (không cần F5 Zalo), tự reload Background Worker. |
| **Nhóm 4: TypeScript & Safety** | **15%** | TypeScript Strict Mode, Type-safe Message Passing, Path Aliases sạch sẽ. |
| **Nhóm 5: Parsimony & Freedom** | **15%** | Bundle nhẹ, không runtime bloat, không khóa chặt kiến trúc (no lock-in). |

---
