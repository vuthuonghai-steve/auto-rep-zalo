# Quality & Risk Audit Checklist: Zalo Personal Automation 24/7

**Purpose**: Thẩm định chất lượng yêu cầu, bảo mật, hiệu năng và kiểm soát rủi ro kiến trúc trước khi triển khai (Shift-Left Verification).  
**Created**: 2026-11-10  
**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)  
**Review Ownership**: Reviewer-owned requirements-quality review artifact.  
**Marker Semantics**: `[ ]` Chưa thẩm định / Cần làm rõ; `[x]` Đã thẩm định và thỏa mãn tiêu chuẩn chất lượng yêu cầu. (Agent sinh danh mục để ngỏ `[ ]` theo đúng quy tắc speckit-checklist).

---

## 1. Yêu Cầu Bảo Mật & Ràng Buộc Manifest V3 CSP (Security & Sandbox Invariants)

- [ ] CHK001 Bản đặc tả có đảm bảo 100% không chứa bất kỳ hành vi gọi API ngầm (`zca-js`, `zlapi`) hoặc giả lập HTTP request tới backend Zalo không?
- [ ] CHK002 Yêu cầu đóng gói bundle có tuân thủ triệt để Manifest V3 CSP: Không `eval()`, không `new Function()`, không inline script, không CDN script từ xa?
- [ ] CHK003 Toàn bộ giao diện điều khiển Floating Panel có được chỉ định bắt buộc phải render bên trong Shadow Root cô lập (`createShadowRootUi` với `cssInjectionMode: 'ui'`) không?
- [ ] CHK004 Cơ chế cô lập sự kiện (`isolateEvents: ['keydown', 'keyup', 'keypress', 'click']`) có ngăn chặn tuyệt đối việc phím tắt trên Floating Panel kích hoạt nhầm tính năng trên Zalo Web không?
- [ ] CHK005 Các dữ liệu cấu hình nhạy cảm (Whitelist nhóm, danh sách SĐT) có được lưu trữ cục bộ an toàn trong trình duyệt mà không gửi ra máy chủ bên ngoài không?

---

## 2. Tính Ổn Định 24/7, Xử Lý Lỗi & Phục Hồi Khi F5 (Resilience & Context Recovery)

- [ ] CHK006 Cơ chế `ContentScriptContext` (`ctx`) có bao bọc 100% các hàm hẹn giờ (`ctx.setInterval`, `ctx.setTimeout`) và DOM listeners để tự động dọn dẹp khi extension reload không?
- [ ] CHK007 Kênh kết nối Port Heartbeat Ping-Pong 20s giữa Content Script và Background Service Worker có kịch bản tự động tái kết nối khi Service Worker bị Chrome giải phóng không?
- [ ] CHK008 Quyền hạn `chrome.power.requestKeepAwake('display')` có được khai báo để ngăn hệ điều hành đưa tab Zalo vào chế độ đóng băng không?
- [ ] CHK009 Khi người dùng nhấn F5 hoặc tab Zalo bị tải lại, hàng chờ `group_dispatch_queue` có cơ chế tự động khôi phục các tác vụ `PROCESSING` về `PENDING` không?
- [ ] CHK010 Circuit Breaker có định nghĩa phản ứng dừng khẩn cấp và cảnh báo thị giác/âm thanh ngay khi Zalo xuất hiện hộp thoại Captcha không?

---

## 3. Kiểm Soát Bộ Nhớ & Hiệu Năng DOM React 18 (Performance & Memory Leaks)

- [ ] CHK011 Bản đặc tả có cấm việc giữ lại các tham chiếu DOM mồ côi (Detached DOM Elements) từ danh sách tin nhắn ảo của React 18 Zalo không?
- [ ] CHK012 Thư viện giao diện Preact + Preact Signals (~3kB) có được xác định rõ ràng nhằm hạn chế tối đa chi phí re-render và tiêu tốn RAM phụ trội `< 20MB` không?
- [ ] CHK013 Bảng `system_logs` có cơ chế tự động xoay vòng Ring-Buffer (Rolling TTL 7 ngày) để chống tràn dung lượng IndexedDB không?
- [ ] CHK014 Tốc độ truy vấn các chỉ mục Dexie.js (`entityKey`, `contentHash`, `createdAt`) có cam kết đạt ngưỡng `< 2ms` không?
- [ ] CHK015 Kích thước bundle của Content Script có được giới hạn nghiêm ngặt dưới ngưỡng `< 60kB` để không làm chậm thời gian tải trang Zalo Web không?

---

## 4. Toàn Vẹn Dữ Liệu & Khử Trùng Lặp 30 Ngày (Dexie.js Integrity & TTL)

- [ ] CHK016 Bản đặc tả có định nghĩa đầy đủ 5 bảng IndexedDB độc lập trong Dexie.js (`app_settings`, `group_checkpoints`, `group_dispatch_queue`, `entities`, `system_logs`) không?
- [ ] CHK017 Cơ chế khử trùng 2 lớp có phân biệt rõ: Lớp 1 theo Số điện thoại chuẩn hóa (`entityKey`) và Lớp 2 theo SHA-256 nội dung sạch (`contentHash`) không?
- [ ] CHK018 Biểu thức chính quy (Regex) bóc tách số điện thoại có xử lý được các biến thể lách luật phổ biến (`O/o` thay cho `0`, dấu chấm, gạch ngang, khoảng trắng xen kẽ) không?
- [ ] CHK019 Thời hạn kiểm tra trùng lặp 30 ngày (`createdAt >= now - 30 days`) có được truy vấn cơ học tự động trước khi cho phép chuyển tiếp gói tin không?
- [ ] CHK020 Mốc nối Checkpoint của từng nhóm (`group_checkpoints`) có được lưu độc lập theo `groupId` để ngăn đọc lặp lại tin cũ không?

---

## 5. Luồng Chuyển Tiếp 2 Pha & Tránh Khóa Tài Khoản (Two-Phase Forwarding & Anti-Ban)

- [ ] CHK021 Bản đặc tả có phân định rạch ròi 2 Pha chuyển tiếp: Pha 1 mở Native Forward Modal cho Media và Pha 2 tiêm Contextual Text cho văn bản đã sửa không?
- [ ] CHK022 Pha 1 có kiểm tra sự kiện Toast xác nhận chia sẻ thành công từ Zalo trước khi chuyển sang Pha 2 không?
- [ ] CHK023 Thao tác gõ văn bản ở Pha 2 có tích hợp Human Micro-Jitter (30ms - 80ms mỗi ký tự) và chuyển đổi tương thích qua `setReactInputValue()` không?
- [ ] CHK024 Hệ thống có đảm bảo tự động chuyển ngược về nhóm nguồn ban đầu ngay sau khi hoàn thành tiêm văn bản ở các nhóm con đích không?
- [ ] CHK025 Độ trễ đệm tĩnh lặng (Inactivity Quiescence) 10 giây có được áp dụng bắt buộc trước khi lưu Checkpoint và giải phóng Mutex Lock không?
- [ ] CHK026 Ràng buộc số lượng nhóm con đích có được giới hạn cứng ở mức tối đa `<= 2` nhóm cho mỗi cụm tin không?

---

## 6. Kiểm Thử Độc Lập & Giả Lập Ngoại Tuyến (Offline Testability & Mock Fixtures)

- [ ] CHK027 Toàn bộ các thuật toán nghiệp vụ (Gom cụm 15s, Bóc tách SĐT, Định tuyến khoảng giá, Lọc trùng Dexie) có khả năng test đơn vị offline 100% qua Vitest + `fake-indexeddb` không?
- [ ] CHK028 Dự án có chuẩn bị sẵn file mẫu tĩnh `tests/fixtures/mock-zalo.html` để phục vụ E2E Playwright mà không cần đăng nhập tài khoản Zalo thật khi dev không?
- [ ] CHK029 Bộ chẩn đoán `SelectorHealthChecker` có được định nghĩa để phát hiện sớm các trường hợp Zalo Web thay đổi class CSS giao diện không?
- [ ] CHK030 Kịch bản E2E có kiểm tra khả năng phục hồi hàng chờ sau khi mô phỏng sự kiện reload trang F5 không?

---

## 7. Kiến Trúc Kiểm Thử Tự Động Hóa Playwright (E2E Lifecycle & Isolation)

- [ ] CHK031 Playwright có được cấu hình Chromium Persistent Context nạp trực tiếp bundle extension MV3 (`--disable-extensions-except=.output/chrome-mv3`, `--load-extension=.output/chrome-mv3`) không?
- [ ] CHK032 Cấu trúc thư mục kiểm thử có tách biệt hoàn toàn 4 tầng: `tests/unit/`, `tests/integration/`, `tests/e2e/`, `tests/fixtures/` không?
- [ ] CHK033 Toàn bộ kịch bản E2E có chạy trên trang fixture `mock-zalo.html` mà không phụ thuộc kết nối mạng hoặc tài khoản Zalo thật không?
- [ ] CHK034 Vòng đời kiểm thử có được đóng gói đầy đủ trong `package.json` qua Bun (`bun test:unit`, `bun test:integration`, `bun test:e2e`, `bun test`) không?

---

## 8. Khả Năng Quan Sát & Nhật Ký Có Cấu Trúc (Observability & Canonical Log Lines)

- [ ] CHK035 Hệ thống có tuân thủ mô hình Wide Events / Canonical Log Lines: Mỗi chu trình chỉ phát sinh DUY NHẤT 1 log line tổng hợp không?
- [ ] CHK036 Mỗi chu trình có gắn một Correlation ID duy nhất (`correlationId`) truyền xuyên suốt từ Node 1 đến Node 10 không?
- [ ] CHK037 Dữ liệu nhạy cảm (SĐT `090****567`, nội dung tin nhắn) có được che chắn (Masking) trước khi chuyển vào Sinks không?
- [ ] CHK038 Hệ thống có hỗ trợ đầy đủ 3 tầng Sinks: Console Sink (DevTools), Dexie Ring-Buffer Sink (bảng `system_logs` TTL 7 ngày), và Diagnostic JSON Exporter không?
- [ ] CHK039 Trang Options có cung cấp nút xuất `diagnostic_logs.json` để tải về toàn bộ log phục vụ phân tích lỗi 24/7 không?

---

## Notes

- Toàn bộ danh mục kiểm tra trên thuộc quyền sở hữu của reviewer/kiểm toán viên kỹ thuật.
- Khi tiến hành nghiệm thu từng tiêu chí, đánh dấu `[x]` sau khi có bằng chứng kiểm chứng cơ học (Mechanical Proof).
- Bản danh mục này đóng vai trò chốt chặn chất lượng (Quality Gate) trước khi cấp quyền triển khai sang giai đoạn Builder/Implementer.

