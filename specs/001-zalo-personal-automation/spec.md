# Feature Specification: Zalo Personal Automation 24/7

**Feature Branch**: `001-zalo-personal-automation`  
**Created**: 2026-11-10  
**Status**: Ready for Architectural Review  
**Input**: Hệ thống Tự Động Hóa Thu Thập, Biên Tập & Phân Phối Tin Nhắn Zalo Đa Nhóm (Zalo Personal Automation 24/7), dựa trên tài liệu kiến trúc ADR-001.

---

## Clarifications / Boundary Interrogation *(speckit-clarify)*

Dưới đây là 5 truy vấn ranh giới kỹ thuật đã được làm rõ và chuẩn hóa trực tiếp từ kiến trúc ADR-001 nhằm loại bỏ hoàn toàn các khoảng trống ngữ nghĩa (Semantic Voids):

1. **Truy vấn 1 (Cơ chế chuyển tiếp Media & Tài nguyên mạng)**:
   - *Hỏi*: Hệ thống có tải media (hình ảnh, video, album) về máy cục bộ rồi nạp lại (re-upload) lên các nhóm đích hay không?
   - *Giải đáp & Chốt*: **KHÔNG**. Hệ thống sử dụng 100% hộp thoại chuyển tiếp gốc của Zalo (`Native Forward Modal` ở Pha 1). Cơ chế này tận dụng hạ tầng CDN và backend của Zalo để phân phối media trực tiếp, đạt 0% chi phí băng thông tải về máy của người vận hành, loại bỏ hoàn toàn nguy cơ lỗi định dạng MIME, lỗi nén giảm độ phân giải, và không để lại dấu vết can thiệp bất thường.

2. **Truy vấn 2 (Xử lý dòng tin nhắn liên tiếp dồn dập)**:
   - *Hỏi*: Người bán thường gửi văn bản trước, sau đó gửi liên tiếp 5-10 ảnh trong vài giây. Làm sao gom trọn vẹn thành 1 gói tin mà không bị xé lẻ?
   - *Giải đáp & Chốt*: **Node 5 (Bundle Aggregator)** thiết lập cửa sổ trượt (Sliding Window) 15 giây kết hợp cơ chế Debounce 2-3 giây dựa trên `senderId`. Chỉ khi người gửi ngừng nhắn trong 2-3 giây hoặc hết khung 15 giây, gói tin mới được niêm phong thành một `EntityBundle` hoàn chỉnh gồm văn bản kèm danh sách media liên kết.

3. **Truy vấn 3 (Xung đột giao diện người dùng & Điều phối đa nhóm)**:
   - *Hỏi*: Nếu nhiều nhóm nguồn cùng phát sinh tin nhắn mới một lúc, hệ thống điều phối việc click chuyển nhóm và mở modal thế nào để không bị kẹt DOM?
   - *Giải đáp & Chốt*: **Node 2 (Queue Manager)** duy trì một hàng chờ đơn với khóa loại trừ tương hỗ tuyệt đối (**Single Mutex Lock FIFO**). Tại bất kỳ thời điểm nào, chỉ có DUY NHẤT một nhóm được mở active trên màn hình. Mỗi thao tác click, chuyển tab, mở modal đều được chèn độ trễ ngẫu nhiên có phân phối chuẩn (**Human Micro-Jitter 1000ms - 2000ms**). Tuyệt đối cấm thao tác song song trên UI.

4. **Truy vấn 4 (Chiến lược khử trùng lặp 30 ngày & Lách luật số điện thoại)**:
   - *Hỏi*: Người bán thường đăng lại tin cũ sau vài ngày hoặc cố tình viết số điện thoại cách điệu (`O9O.123.4567`, `09O-xxx`) để lách bộ lọc. Cơ chế lọc trùng hoạt động thế nào?
   - *Giải đáp & Chốt*: **Node 6 (Dedup Gate)** thực thi kiểm tra 2 lớp lưu vết trên IndexedDB (bảng `entities` của Dexie.js) trong thời hạn cuốn chiếu 30 ngày:
     - *Lớp 1 (`entityKey`)*: Số điện thoại được giải mã qua bộ quy tắc regex thay thế ký tự tương đồng (`O/o` -> `0`, `I/l` -> `1`, xóa dấu chấm, gạch ngang) để trích xuất SĐT chuẩn 10 chữ số.
     - *Lớp 2 (`contentHash`)*: Mã băm SHA-256 nội dung văn bản sau khi chuẩn hóa (loại bỏ toàn bộ khoảng trắng thừa, ký tự xuống dòng và emoji).
     - Nếu trùng bất kỳ lớp nào với bản ghi còn hiệu lực trong 30 ngày, gói tin bị hủy ngay lập tức và ghi log `DEDUPLICATED`.

5. **Truy vấn 5 (Xử lý sự cố bất thường: Zalo Captcha & Đổi tên class CSS)**:
   - *Hỏi*: Hệ thống phản ứng thế nào nếu Zalo yêu cầu xác thực người dùng (Captcha) hoặc VNG cập nhật giao diện làm mất class CSS?
   - *Giải đáp & Chốt*: Kích hoạt cơ chế **Circuit Breaker**:
     - Khi phát hiện hộp thoại Captcha: Khóa ngay hàng chờ xử lý, chuyển trạng thái Floating Panel sang màu đỏ `CAPTCHA_PAUSED`, phát tín hiệu âm thanh cảnh báo nội bộ trên browser, giữ nguyên hiện trạng để người vận hành trực tiếp giải Captcha.
     - Khi mất selector: Hệ thống kích hoạt **3-Tier Selector Fallback** (data attribute -> DOM hierarchy + text -> CSS class). Nếu toàn bộ 3 tầng đều thất bại, chuyển trạng thái sang `SELECTOR_OUTDATED`, ghi log chi tiết tên phần tử bị thiếu, không click bừa bãi.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Khởi Tạo, Cấu Hình Whitelist & Giám Sát Floating Panel (Priority: P1 - Core MVP)

Người vận hành cá nhân (Solo Operator) cài đặt Extension vào trình duyệt Chromium, mở tab `chat.zalo.me`, kích hoạt tiện ích. Giao diện Floating Panel xuất hiện tinh gọn ở góc phải màn hình bên trong Shadow DOM mà không làm vỡ giao diện Zalo. Người vận hành mở trang Options để cấu hình danh sách nhóm nguồn được phép lắng nghe (Whitelist Source Groups), các nhóm đích (Target Destination Groups), và quy tắc ánh xạ khoảng giá.

**Why this priority**: Đây là nền tảng cốt lõi (Core MVP). Không có tầng cấu hình, khởi tạo cơ sở dữ liệu IndexedDB 5 bảng và Floating Panel điều khiển, toàn bộ chu trình tự động hóa không thể bắt đầu và không thể kiểm soát an toàn.

**Independent Test**: Cài extension lên Chromium, mở tab Zalo Web. Xác minh Floating Panel hiển thị với trạng thái `IDLE`, cấu hình Whitelist lưu thành công vào `app_settings` trong Dexie.js, và bảng `system_logs` ghi nhận sự kiện khởi tạo hệ thống.

**Acceptance Scenarios**:
1. **Given** Người vận hành đã đăng nhập Zalo Web tại `chat.zalo.me`, **When** Extension được nạp và kích hoạt, **Then** Một Floating Panel hiển thị ở góc phải phía trên màn hình trong Shadow DOM cô lập, hiển thị trạng thái `IDLE`, số lượng hàng chờ `0`, và nút dừng khẩn cấp `Emergency Stop`.
2. **Given** Người vận hành mở trang Options của Extension, **When** Nhập danh sách nhóm nguồn kèm theo nhóm đích và bảng ánh xạ khoảng giá rồi bấm "Lưu Cấu Hình", **Then** Dữ liệu được xác thực qua Zod Schema và lưu bền vững vào bảng `app_settings` của Dexie.js, đồng thời phát tín hiệu cập nhật sang Content Script qua message passing.
3. **Given** Hệ thống đang chạy tự động, **When** Người vận hành bấm nút `Emergency Stop` trên Floating Panel, **Then** Toàn bộ hàng chờ dừng xử lý ngay lập tức, trạng thái chuyển sang `STOPPED`, và khóa Mutex Lock được giải phóng an toàn.

---

### User Story 2 - Thu Thập, Ghép Nối Delta & Gom Cụm Tin Nhắn (Priority: P2)

Hệ thống tự động theo dõi danh sách hội thoại ở Sidebar của Zalo Web. Khi một nhóm nguồn trong Whitelist có tin nhắn mới, hệ thống đưa nhóm vào hàng chờ FIFO, tự động chuyển vào nhóm đó (nếu đang rảnh), neo chắc chắn ở đáy khung chat, đối chiếu Checkpoint gần nhất để lấy đúng các tin nhắn mới (Delta), và gom cụm các tin liên tiếp của cùng một người gửi thành gói tin `EntityBundle`.

**Why this priority**: Đảm bảo thu thập dữ liệu chính xác, không sót tin, không đọc thừa tin cũ, và xử lý được thói quen gửi tin nhắn rời rạc kèm album ảnh của người bán bất động sản/hàng hóa trên Zalo.

**Independent Test**: Giả lập nhận 3 tin nhắn liên tiếp từ cùng một sender (1 tin văn bản + 2 ảnh). Xác minh hệ thống gom đúng thành 1 `EntityBundle` duy nhất sau 2 giây debounce với đầy đủ nội dung văn bản và URL media tạm.

**Acceptance Scenarios**:
1. **Given** Nhóm nguồn nằm trong Whitelist nhận tin nhắn mới được phát hiện bởi `MutationObserver` tại Sidebar, **When** Trạng thái hàng chờ đang rảnh (`isProcessing = false`), **Then** Nhóm được đưa vào bảng `group_dispatch_queue` và kích hoạt Node 3 mở nhóm nguồn trên màn hình.
2. **Given** Nhóm chat nguồn đang mở, có biểu tượng thông báo "99+ tin chưa đọc", **When** Node 3 neo vào khung chat, **Then** Hệ thống bỏ qua nút 99+, chỉ neo ở đáy khung chat và quét tối đa 5-10 tin nhắn dưới cùng để ghép nối với mốc trong `group_checkpoints`.
3. **Given** Người gửi liên tiếp gửi 1 tin mô tả văn bản và 4 ảnh trong vòng 8 giây, **When** Không có tin mới sau 2.5 giây debounce, **Then** Node 5 niêm phong gói `EntityBundle` chứa toàn bộ 1 text và 4 media IDs, gán cờ sẵn sàng chuyển sang cổng thẩm định.

---

### User Story 3 - Khử Trùng Lặp 30 Ngày & Định Tuyến Khoảng Giá (Priority: P3)

Gói tin `EntityBundle` được chuyển tới Node 6 để kiểm tra tính hợp lệ và lọc trùng. Hệ thống bóc tách số điện thoại (kể cả dạng lách luật) và tính toán băm SHA-256 nội dung. Sau đó đối soát với bảng `entities` trong IndexedDB trong vòng 30 ngày. Nếu không trùng, Node 7 bóc tách khoảng giá và xác định tối đa `<= 2` nhóm con đích phù hợp theo ma trận cấu hình.

**Why this priority**: Ngăn chặn tình trạng spam rác, tin trùng lặp nhiều lần gây loãng các nhóm đích và vi phạm quy định cộng đồng, đồng thời phân loại tin nhắn về đúng nhóm chuyên biệt theo ngân sách.

**Independent Test**: Gửi 1 tin có nội dung đã được xử lý trong vòng 7 ngày trước. Xác minh hệ thống nhận diện `DUPLICATE_CONTENT_HASH`, từ chối chuyển tiếp, và cập nhật trạng thái gói tin thành `SKIPPED_DEDUPLICATED`.

**Acceptance Scenarios**:
1. **Given** Một gói tin chứa số điện thoại dạng lách luật `O912.345.678` và nội dung văn bản mới, **When** Node 6 thực thi bóc tách, **Then** Số điện thoại được chuẩn hóa thành `0912345678` (`entityKey`) và nội dung được băm SHA-256 (`contentHash`).
2. **Given** Một gói tin có `entityKey` hoặc `contentHash` đã tồn tại trong bảng `entities` với mốc thời gian `<= 30 ngày`, **When** Node 6 kiểm tra, **Then** Gói tin bị đánh dấu trùng, hủy bỏ việc chuyển tiếp, và ghi log `DEDUPLICATED` vào bảng `system_logs`.
3. **Given** Gói tin hợp lệ và không trùng lặp, chứa mức giá "15.5 tỷ", **When** Node 7 đối chiếu với Price Route Rules, **Then** Hệ thống xác định danh sách tối đa `<= 2` nhóm con đích thuộc phân khúc "10 - 20 tỷ".

---

### User Story 4 - Chuyển Tiếp Tự Động 2 Pha & Hoàn Tất Chu Trình (Priority: P4)

Gói tin hợp lệ được chuyển tiếp qua quy trình 2 Pha: Pha 1 mở hộp thoại Native Forward Modal của Zalo, chọn đúng các nhóm con đích và gửi media. Sau khi Zalo hiện thông báo "Đã chia sẻ" thành công, hệ thống chuyển sang Pha 2: tuần tự mở từng nhóm con đích, tiêm nội dung văn bản đã được biên tập (sửa số điện thoại liên hệ cá nhân, chèn ghi chú), mô phỏng gõ phím với Micro-Jitter, gửi tin nhắn, rồi quay trở lại nhóm nguồn. Cuối cùng, hệ thống chờ đệm tĩnh lặng 10s trước khi lưu Checkpoint và giải phóng hàng chờ.

**Why this priority**: Đây là khâu hoàn thiện giá trị kinh doanh cuối cùng của chuỗi tự động hóa: tin nhắn được phân phối trọn vẹn gồm cả media gốc lẫn văn bản biên tập chuẩn xác mà không cần con người can thiệp thủ công.

**Independent Test**: Chạy thử nghiệm trên trang fixture giả lập. Xác minh modal chuyển tiếp được kích hoạt, các nhóm đích được chọn, sự kiện Toast thành công được bắt, và văn bản đã biên tập được gửi vào nhóm đích trước khi trở về nhóm nguồn.

**Acceptance Scenarios**:
1. **Given** Gói tin có media cần chuyển tiếp, **When** Node 8 click nút "Chia sẻ" trên tin nhắn Zalo, **Then** Native Forward Modal mở ra, hệ thống gõ tên nhóm con đích vào ô tìm kiếm, tick chọn checkbox nhóm, và click "Chia sẻ".
2. **Given** Pha 1 hoàn thành và màn hình xuất hiện Toast thông báo "Đã chia sẻ", **When** Chuyển sang Pha 2 (Node 9), **Then** Hệ thống mở nhóm con đích, dùng `setReactInputValue()` và mô phỏng gõ phím với Human Jitter (30ms - 80ms/ký tự) để điền văn bản đã sửa SĐT, rồi bấm gửi.
3. **Given** Đã gửi xong ở tất cả nhóm con đích, **When** Node 9 hoàn tất, **Then** Hệ thống tự động click chuyển ngược lại nhóm nguồn ban đầu.
4. **Given** Đã quay về nhóm nguồn, **When** Node 10 (Committer & Drain) kích hoạt, **Then** Hệ thống đếm ngược đệm tĩnh lặng 10s (Inactivity Quiescence), cập nhật mốc ID tin nhắn mới nhất vào `group_checkpoints`, xóa item khỏi `group_dispatch_queue`, và chuyển trạng thái về `IDLE`.

---

### Edge Cases

1. **Người dùng nhấn F5 hoặc Extension bị reload giữa chừng**:
   - Khi khởi động lại, Node 2 đọc bảng `group_dispatch_queue` trong Dexie.js. Nếu phát hiện tác vụ ở trạng thái `PROCESSING`, hệ thống tự động reset về `PENDING` và phục hồi lại việc xử lý mà không làm mất hàng chờ.
2. **Gặp hộp thoại Captcha hoặc cảnh báo bất thường từ Zalo**:
   - `CircuitBreaker` kích hoạt ngay lập tức. Dừng toàn bộ các timer, không click bất kỳ nút nào trên UI, bật cờ `isPausedByCaptcha = true`, chuyển màu Floating Panel sang Đỏ nhấp nháy, phát chuông báo `Audio()` và thông báo qua browser notification.
3. **Giao diện Zalo thay đổi class CSS (Selector Outdated)**:
   - Hệ thống lần lượt chuyển qua 3 tầng Fallback: (1) `data-id` / `data-translate-inner`, (2) Text nội dung và cây quan hệ cha con DOM, (3) Class CSS cũ. Nếu thất bại cả 3, ghi log `CRITICAL_SELECTOR_MISSING`, tạm dừng xử lý nhóm đó và báo động trên Floating Panel.
4. **Tin nhắn chỉ có Text không có Media hoặc chỉ có Media không có Text**:
   - Nếu chỉ có Text: Bỏ qua Pha 1 (không mở Native Forward Modal), thực hiện trực tiếp Pha 2 tại các nhóm con đích.
   - Nếu chỉ có Media (không có Text và không có SĐT): Pha 1 chuyển tiếp bình thường, Pha 2 không cần inject văn bản biên tập.
5. **Đứt kết nối Service Worker (Chrome MV3 Idle Termination sau 30s)**:
   - Cơ chế Heartbeat 20s giữa Content Script và Service Worker duy trì kết nối Port liên tục; khi Port bị ngắt, Content Script tự động kết nối lại (`chrome.runtime.connect`) sau 1000ms.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Hệ thống BẮT BUỘC theo dõi danh sách hội thoại tại Sidebar (`#conversationList`) bằng `MutationObserver` bất đồng bộ để phát hiện tin nhắn mới theo thời gian thực (Node 1).
- **FR-002**: Hệ thống BẮT BUỘC quản lý toàn bộ các yêu cầu xử lý nhóm thông qua một hàng chờ tuần tự duy nhất (**Single Mutex Lock FIFO**) lưu trữ bền vững tại bảng `group_dispatch_queue` (Node 2).
- **FR-003**: Hệ thống BẮT BUỘC tự động chuyển đổi sang nhóm chat nguồn bằng mô phỏng click có Human Jitter (1000ms - 2000ms) và neo cố định ở đáy khung chat (Node 3).
- **FR-004**: Hệ thống BẮT BUỘC bỏ qua nút "99+ tin chưa đọc" khi mở nhóm; chỉ đối chiếu với `group_checkpoints` và cuộn quét tối đa 5-10 tin nhắn đáy gần nhất để lấy delta (Node 4).
- **FR-005**: Hệ thống BẮT BUỘC gom cụm các tin nhắn (văn bản + album ảnh/media) của cùng một người gửi trong khung thời gian trượt 15 giây với cơ chế Debounce 2-3 giây thành một gói tin `EntityBundle` (Node 5).
- **FR-006**: Hệ thống BẮT BUỘC kiểm tra tính hợp lệ và lọc trùng lặp 2 lớp (`entityKey` và `contentHash`) đối chiếu với bảng `entities` trong thời hạn rolling 30 ngày trước khi cho phép chuyển tiếp (Node 6).
- **FR-007**: Hệ thống BẮT BUỘC bóc tách số điện thoại qua biểu thức chính quy xử lý ký tự thay thế tương đồng, trích xuất khoảng giá và ánh xạ ra tối đa `<= 2` nhóm con đích theo cấu hình (Node 7).
- **FR-008**: Hệ thống BẮT BUỘC thực hiện chuyển tiếp media bằng cách tương tác với hộp thoại chia sẻ gốc của Zalo (**Native Forward Modal** ở Pha 1) và chờ sự kiện Toast xác nhận chia sẻ thành công (Node 8).
- **FR-009**: Hệ thống BẮT BUỘC mở từng nhóm con đích để tiêm văn bản đã được biên tập lại số điện thoại/chú thích ở Pha 2, sử dụng `setReactInputValue()` tương thích React 18 và micro-jitter gõ phím con người (Node 9).
- **FR-010**: Hệ thống BẮT BUỘC quay trở lại nhóm chat nguồn ban đầu ngay sau khi hoàn thành việc tiêm văn bản ở các nhóm con đích (Node 9).
- **FR-011**: Hệ thống BẮT BUỘC duy trì đệm chờ tĩnh lặng (Inactivity Quiescence) 10 giây trước khi cập nhật `group_checkpoints` và giải phóng Mutex Lock cho nhóm tiếp theo (Node 10).
- **FR-012**: Hệ thống BẮT BUỘC hiển thị bảng điều khiển Floating Panel nổi góc phải trong Shadow DOM với Preact Signals, cho phép xem trạng thái, số lượng hàng chờ, và nút dừng khẩn cấp `Emergency Stop`.
- **FR-013**: Hệ thống BẮT BUỘC cung cấp trang Options để quản lý Whitelist nhóm nguồn/đích, cấu hình bảng khoảng giá, và xem nhật ký lỗi Ring-Buffer từ bảng `system_logs`.
- **FR-014**: Hệ thống BẮT BUỘC tự động dọn dẹp các bản ghi log quá hạn 7 ngày và entities quá hạn 30 ngày để đảm bảo dung lượng lưu trữ IndexedDB không vượt ngưỡng kiểm soát.
- **FR-015**: Hệ thống BẮT BUỘC duy trì kết nối Heartbeat Ping-Pong 20 giây giữa Content Script và Background Service Worker kết hợp `chrome.power` để ngăn chặn trình duyệt đóng băng tab hoặc service worker 24/7.

### Non-Functional Requirements (Testing & Observability)

- **NFR-TEST-001 (Kiến Trúc Kiểm Thử Phân Tầng)**: Hệ thống BẮT BUỘC thiết lập 4 tầng kiểm thử tách biệt:
  1. *Unit Tests* (`tests/unit/`): Kiểm thử hộp trắng cho pure logic (chuẩn hóa regex SĐT, bóc tách khoảng giá, gom cụm tin 15s, Zod schema) chạy qua Vitest + `fake-indexeddb` trong RAM `< 1s`.
  2. *Integration Tests* (`tests/integration/`): Kiểm thử tương tác giữa Dexie Repositories, IPC Protocol và chu trình State Transition của hàng chờ Single Mutex FIFO.
  3. *End-to-End Tests* (`tests/e2e/`): Kiểm thử tự động qua Playwright trên Chromium Persistent Context nạp trực tiếp bundle extension MV3 (`--disable-extensions-except=.output/chrome-mv3`, `--load-extension=.output/chrome-mv3`).
  4. *Test Fixtures* (`tests/fixtures/`): Lưu trữ các bản chụp DOM tĩnh chuẩn của Zalo Web (`mock-zalo.html`) đảm bảo test chạy 100% offline, không cần tài khoản thật.
- **NFR-TEST-002 (Vòng Đời Kiểm Thử & CI Scripts)**: Toàn bộ quy trình kiểm thử phải được đóng gói thành các lệnh Bun thực thi xác định: `bun test:unit`, `bun test:integration`, `bun test:e2e`, và `bun test` (tổng hợp).
- **NFR-OBS-001 (Wide Events / Canonical Log Lines)**: Mỗi chu trình xử lý (Queue Dispatch, Two-Phase Forward, DOM Staging, Circuit Breaker) BẮT BUỘC chỉ phát sinh DUY NHẤT một bản ghi sự kiện có cấu trúc (Wide Event / Canonical Log Line) chứa đầy đủ thông tin: `correlationId`, `operation`, `nodeId`, `status`, `durationMs`, `groupId`, `senderIdMasked`, `phoneMasked`, `retryCount`, và `errorPayload`.
- **NFR-OBS-002 (Đa Tầng Sinks & Xoay Vòng Nhật Ký)**: Hệ thống BẮT BUỘC hỗ trợ 3 tầng sink xuất log:
  1. *Console Sink*: Hiển thị trực tiếp trên trình duyệt DevTools console với mã màu phân cấp.
  2. *Dexie Ring-Buffer Sink*: Lưu trữ có cấu trúc trong bảng `system_logs` của IndexedDB với cơ chế tự động xoay vòng cuốn chiếu 7 ngày (Rolling 7-day TTL).
  3. *Diagnostic JSON Exporter*: Cho phép người dùng bấm xuất toàn bộ nhật ký ra tệp `diagnostic_logs.json` từ trang Options để gửi báo cáo lỗi.
- **NFR-OBS-003 (Bảo Mật Dữ Liệu & Masking)**: Mọi thông tin định danh cá nhân ghi vào log BẮT BUỘC phải qua cơ chế che chắn (Data Masking): Số điện thoại chỉ hiển thị 3 số đầu và 3 số cuối (ví dụ: `090****567`), nội dung tin nhắn thô bị cắt ngắn và ẩn các chuỗi nhạy cảm.

### Key Entities

1. **`AppSetting`** (Bảng `app_settings`):
   - Quản lý cấu hình toàn cục: `key` (chuỗi định danh), `value` (JSON chứa Whitelist nhóm nguồn, danh sách nhóm đích, bảng định tuyến khoảng giá, cấu hình jitter).
2. **`GroupCheckpoint`** (Bảng `group_checkpoints`):
   - Mốc đồng bộ tin nhắn theo nhóm: `groupId` (chuỗi ID nhóm Zalo), `lastMessageId` (ID tin nhắn cuối cùng đã xử lý), `lastSenderId` (người gửi cuối), `updatedAt` (timestamp ms).
3. **`DispatchQueueItem`** (Bảng `group_dispatch_queue`):
   - Hàng chờ điều phối nhóm: `id` (auto-increment), `groupId` (ID nhóm), `status` (`PENDING` | `PROCESSING` | `FAILED` | `COMPLETED`), `retryCount` (số lần thử lại), `enqueuedAt` (thời điểm vào hàng chờ).
4. **`MessageEntity`** (Bảng `entities`):
   - Bản ghi lưu vết khử trùng 30 ngày: `id` (auto-increment), `entityKey` (SĐT chuẩn hóa), `contentHash` (SHA-256 chuỗi văn bản sạch), `rawText` (nội dung gốc), `sourceGroupId` (nhóm nguồn), `targetGroupIds` (danh sách nhóm đích đã gửi), `createdAt` (timestamp phục vụ TTL 30 ngày).
5. **`SystemLog`** (Bảng `system_logs` - Canonical Log Line):
   - Nhật ký vận hành Wide Event Ring-Buffer: `id` (auto-increment), `correlationId` (UUID truy vết chu trình), `operation` (tên chu trình), `level` (`INFO` | `WARN` | `ERROR` | `CRITICAL`), `nodeId` (`N01`..`N10`), `status` (`SUCCESS` | `FAILURE` | `DEGRADED`), `durationMs` (thời gian xử lý ms), `groupId` (ID nhóm), `senderIdMasked` (ID người gửi che dấu), `phoneMasked` (SĐT masked `090****567`), `message` (tóm tắt kết quả), `errorPayload` (chi tiết lỗi nếu có), `timestamp` (thời điểm ghi nhận, Rolling TTL 7 ngày).

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Toàn bộ chu trình từ khi phát hiện tin nhắn mới ở nhóm nguồn đến khi hoàn tất chuyển tiếp 2 Pha cho 1 cụm tin phải hoàn thành trong thời gian `< 15 giây` (không tính 10s đệm tĩnh lặng của Node 10).
- **SC-002**: Tỷ lệ khử trùng lặp chính xác đạt `100%`: Không có bất kỳ tin nhắn nào có cùng `entityKey` hoặc `contentHash` được chuyển tiếp quá 1 lần trong vòng 30 ngày.
- **SC-003**: Độ tin cậy phục hồi hàng chờ sau khi nhấn F5 đạt `100%`: Không bị mất tác vụ đang chờ trong `group_dispatch_queue`.
- **SC-004**: Tỷ lệ rò rỉ CSS hoặc xung đột sự kiện giữa Floating Panel và Zalo Web đạt `0%` nhờ Shadow DOM và `isolateEvents: true`.
- **SC-005**: Dung lượng bộ nhớ RAM phụ trội của Extension trên tab `chat.zalo.me` duy trì ở mức `< 20MB`; dung lượng bundle của Content Script `< 60kB`.
- **SC-006**: Toàn bộ các bài kiểm tra tự động (Unit test với `fake-indexeddb` và E2E với Chromium mock fixture) đạt tỷ lệ đạt `100%` (Exit code 0).
- **SC-007**: 100% các chu trình xử lý (Queue Dispatch, Two-Phase Forward, DOM Staging) phát sinh đúng 1 bản ghi Wide Event / Canonical Log Line với Correlation ID duy nhất.
- **SC-008**: 100% số điện thoại và thông tin nhạy cảm ghi vào `system_logs` tuân thủ quy chuẩn Masking (`090****567`), không để lọt plain-text SĐT.
- **SC-009**: Bộ kiểm thử Playwright E2E nạp trực tiếp bundle extension MV3 vào Chromium Persistent Context vượt qua 100% các kịch bản kiểm thử luồng 2 Pha và khôi phục khi F5.

---

## Assumptions

- Người vận hành sử dụng trình duyệt Chromium hiện đại (Chrome/Brave/Edge) và duy trì đăng nhập hợp lệ trên tab `chat.zalo.me`.
- Cấu trúc DOM của Zalo Web giữ nguyên các thuộc tính ngữ nghĩa cốt lõi; trường hợp thay đổi class CSS thì hệ thống fallback theo data attributes và text hierarchy.
- Máy tính của người vận hành được cắm nguồn và kết nối internet ổn định cho chế độ chạy 24/7.
- Số lượng nhóm nguồn được kích hoạt trong danh sách Whitelist ở quy mô cá nhân thường dao động từ 5 đến 20 nhóm.

---

## Negative Space / Boundaries *(SPEC-INV-003 Mandate)*

Hệ thống cam kết TUYỆT ĐỐI KHÔNG thực hiện các điều sau:
1. **KHÔNG can thiệp vào các nhóm chat không nằm trong Whitelist**: Bỏ qua 100% các tin nhắn từ bạn bè, người lạ hoặc nhóm không được cấu hình.
2. **KHÔNG tự động giải Captcha**: Khi gặp Captcha, hệ thống dừng lại và phát cảnh báo để con người xử lý; không tích hợp dịch vụ giải captcha bên ngoài.
3. **KHÔNG tải media về ổ cứng để re-upload**: Không chiếm dụng băng thông và dung lượng lưu trữ tệp cục bộ.
4. **KHÔNG gọi bất kỳ API riêng tư/ngầm nào của Zalo**: Giữ nguyên trạng thái an toàn 100% như người dùng duyệt web bình thường.
5. **KHÔNG thực thi đồng thời các thao tác trên DOM**: Bắt buộc tuân thủ Single Mutex FIFO.

