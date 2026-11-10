# Tasks: Zalo Personal Automation 24/7

**Input**: Design documents from `specs/001-zalo-personal-automation/` (`spec.md`, `plan.md`, `checklist.md`).  
**Prerequisites**: `spec.md` (required), `plan.md` (required), `checklist.md` (required).  
**Tests**: 4-Tier Testing Lifecycle: Unit (`tests/unit/`), Integration (`tests/integration/`), E2E (`tests/e2e/`), Fixtures (`tests/fixtures/`) are required per Constitution & Testing Architecture.  
**Observability**: Wide Events / Canonical Log Lines with Correlation ID, Data Masking & Multi-Sink per Logging Architecture.  
**Organization**: Tasks are grouped by phase and user story to enable independent implementation and testing of each story increment.

---

## Format: `- [ ] [TaskID] [P?] [Story?] Description with file path`

- **[P]**: Can run in parallel (zero file intersection, no dependencies on incomplete tasks).
- **[Story]**: Belongs to user story phase (e.g., [US1], [US2], [US3], [US4]).
- Descriptions include explicit, exact file paths.

---

## Phase 1: Setup (Shared Infrastructure & Test Harness)

**Purpose**: Khởi tạo cấu trúc dự án, môi trường Bun, WXT Framework, Biome, Vitest, Playwright MV3 harness và fixtures.

- [x] T001 Khởi tạo cấu hình dự án Bun và WXT Manifest V3 tại package.json và wxt.config.ts
- [x] T002 [P] Thiết lập cấu hình TypeScript Strict Mode tại tsconfig.json
- [x] T003 [P] Cấu hình bộ linter và formatter Biome duy nhất tại biome.json
- [x] T004 [P] Cấu hình môi trường kiểm thử Vitest với fake-indexeddb và happy-dom tại vitest.config.ts
- [x] T005 [P] Cấu hình Playwright test runner cho Chromium MV3 Persistent Context tại playwright.config.ts
- [x] T006 [P] Tạo mẫu DOM Zalo Web giả lập phục vụ kiểm thử E2E tại tests/fixtures/mock-zalo.html

---

## Phase 2: Foundational (Blocking Prerequisites & Observability Core)

**Purpose**: Hạ tầng lõi bắt buộc phải hoàn thành trước khi triển khai bất kỳ User Story nào (Database 5 bảng, Wide Event Logger, Correlation Context, Hợp đồng Zod, IPC, Selectors, DOM bridge, Pacing guard).

- [x] T007 Khởi tạo cơ sở dữ liệu Dexie 5 bảng (`app_settings`, `group_checkpoints`, `group_dispatch_queue`, `entities`, `system_logs` chuẩn Canonical Log) tại src/db/database.ts kèm unit test tại tests/unit/db.test.ts
- [x] T008 [P] Xây dựng repository quản lý hàng chờ và phục hồi trạng thái sau F5 tại src/db/queue-repo.ts kèm integration test tại tests/integration/queue-repo.test.ts
- [x] T009 [P] Xây dựng repository khử trùng lặp 2 lớp và xoay vòng 30 ngày tại src/db/dedup-repo.ts kèm integration test tại tests/integration/dedup-repo.test.ts
- [x] T010 [P] Xây dựng repository nhật ký xoay vòng Ring-Buffer tự động dọn dẹp TTL 7 ngày và export JSON tại src/db/log-repo.ts kèm integration test tại tests/integration/log-repo.test.ts
- [x] T011 [P] Xây dựng Context quản lý Correlation ID truy vết xuyên chu trình tại src/utils/correlation.ts kèm unit test tại tests/unit/correlation.test.ts
- [x] T012 [P] Xây dựng Logger đa tầng phát Canonical Log Line kèm Data Masking (SĐT 090****567) tại src/utils/logger.ts kèm unit test tại tests/unit/logger.test.ts
- [x] T013 [P] Định nghĩa các schema Zod kiểm duyệt hợp đồng dữ liệu tại src/contracts/schemas.ts
- [x] T014 [P] Định nghĩa bản đồ giao tiếp IPC type-safe giữa Content Script và Service Worker tại src/contracts/messaging.ts kèm integration test tại tests/integration/messaging-ipc.test.ts
- [x] T015 [P] Xây dựng bộ giải quyết DOM Selector 3 tầng Fallback tại src/contracts/selectors.ts kèm unit test tại tests/unit/selectors.test.ts
- [x] T016 [P] Xây dựng tiện ích cầu nối React 18 DOM Bridge (`setReactInputValue`) tại src/utils/react-dom-bridge.ts kèm unit test tại tests/unit/react-dom-bridge.test.ts
- [x] T017 [P] Xây dựng bộ tạo độ trễ phân phối ngẫu nhiên và Circuit Breaker tại src/utils/pacing-guard.ts kèm unit test tại tests/unit/pacing-guard.test.ts

**Checkpoint**: Nền tảng hạ tầng & Observability hoàn tất - Cho phép triển khai User Story 1 (Core MVP).

---

## Phase 3: User Story 1 - Khởi Tạo, Cấu Hình Whitelist & Giám Sát Floating Panel (Priority: P1) 🎯 MVP

**Goal**: Cung cấp giao diện nổi góc phải trong Shadow DOM, trang Options cấu hình Whitelist/Khoảng giá, xuất log JSON, nút Emergency Stop, và Service Worker giữ thức 24/7.  
**Independent Test**: Kích hoạt extension trên tab Zalo Web; kiểm tra Floating Panel hiển thị `IDLE`, cấu hình Whitelist lưu vào Dexie `app_settings`, và bấm `Emergency Stop` chuyển trạng thái `STOPPED`.

- [x] T018 [US1] Xây dựng Service Worker giữ thức 24/7 với Heartbeat Port 20s và Watchdog tại entrypoints/background.ts
- [x] T019 [P] [US1] Xây dựng giao diện trang Options quản trị Whitelist, ma trận khoảng giá và nút xuất diagnostic_logs.json tại entrypoints/options/main.tsx và entrypoints/options/index.html
- [x] T020 [P] [US1] Xây dựng component Floating Panel với Preact Signals hiển thị trạng thái và hàng chờ tại entrypoints/zalo.content/FloatingPanel.tsx
- [x] T021 [US1] Tích hợp createShadowRootUi cô lập CSS và Event vào Content Script tại entrypoints/zalo.content/index.tsx và entrypoints/zalo.content/style.css
- [x] T022 [US1] Kết nối nút Emergency Stop trên Floating Panel để khóa Mutex và dừng hàng chờ tại entrypoints/zalo.content/FloatingPanel.tsx
- [x] T023 [US1] Viết bài kiểm thử đơn vị và tích hợp cho giao tiếp Options và Dexie Settings tại tests/unit/us1-init-options.test.ts

**Checkpoint**: User Story 1 hoàn thành độc lập - Bản MVP đầu tiên có thể chạy thử nghiệm trực tiếp trên browser.

---

## Phase 4: User Story 2 - Thu Thập, Ghép Nối Delta & Gom Cụm Tin Nhắn (Priority: P2)

**Goal**: Theo dõi Sidebar, đưa nhóm vào hàng chờ FIFO, mở nhóm nguồn, quét 5-10 tin đáy (bỏ qua nút 99+), gom cụm Media + Text theo senderId trong cửa sổ 15s (debounce 2-3s), emit Canonical Log Line `QUEUE_DISPATCH`.  
**Independent Test**: Giả lập phát sinh 3 tin nhắn liên tiếp từ cùng một sender trên DOM giả lập; kiểm tra xuất ra 1 `EntityBundle` hoàn chỉnh sau 2.5s debounce.

- [x] T024 [US2] Hiện thực Node 1: MutationObserver bất đồng bộ theo dõi `#conversationList` Sidebar tại src/nodes/n01-sidebar-observer.ts kèm unit test tại tests/unit/us2-collection-pipeline.test.ts
- [x] T025 [US2] Hiện thực Node 2: Bộ điều phối hàng chờ Single Mutex FIFO, phục hồi sau F5 và tích hợp Canonical Log Line tại src/nodes/n02-queue-manager.ts kèm unit test tại tests/unit/us2-collection-pipeline.test.ts
- [x] T026 [US2] Hiện thực Node 3: Chuyển đổi nhóm chat nguồn và neo đáy DOM tại src/nodes/n03-chat-switcher.ts kèm unit test tại tests/unit/us2-collection-pipeline.test.ts
- [x] T027 [US2] Hiện thực Node 4: Khớp Checkpoint, bỏ qua nút 99+, quét 5-10 tin đáy tại src/nodes/n04-delta-stitcher.ts kèm unit test tại tests/unit/us2-collection-pipeline.test.ts
- [x] T028 [US2] Hiện thực Node 5: Gom cụm Media + Text theo senderId (cửa sổ 15s, debounce 2-3s) tại src/nodes/n05-bundle-aggregator.ts kèm unit test tại tests/unit/us2-collection-pipeline.test.ts
- [x] T029 [US2] Viết bài kiểm thử tích hợp chuỗi thu thập tin từ Node 1 đến Node 5 tại tests/unit/us2-collection-pipeline.test.ts

**Checkpoint**: User Story 2 hoàn thành độc lập - Dữ liệu thô từ Zalo Web được thu thập và đóng gói thành công.

---

## Phase 5: User Story 3 - Khử Trùng Lặp 30 Ngày & Định Tuyến Khoảng Giá (Priority: P3)

**Goal**: Bóc tách số điện thoại lách luật (regex), băm SHA-256 nội dung, kiểm tra trùng 2 lớp 30 ngày trong Dexie `entities`, định tuyến khoảng giá tới tối đa <= 2 nhóm con đích, che chắn SĐT nhạy cảm.  
**Independent Test**: Đưa vào gói tin có số điện thoại `O9O.123.4567` đã tồn tại trong 30 ngày; xác minh hệ thống từ chối chuyển tiếp và đánh dấu `DEDUPLICATED`.

- [x] T030 [P] [US3] Hiện thực tiện ích băm SHA-256 chuẩn Web Crypto API tại src/utils/crypto-hash.ts kèm unit test tại tests/unit/crypto-hash.test.ts
- [x] T031 [US3] Hiện thực Node 6: Cổng khử trùng lặp 2 lớp (`entityKey` và `contentHash` 30 ngày) tại src/nodes/n06-dedup-gate.ts kèm unit test tại tests/unit/us3-dedup-routing.test.ts
- [x] T032 [US3] Hiện thực Node 7: Bóc tách SĐT lách luật regex và định tuyến khoảng giá tới <= 2 nhóm con tại src/nodes/n07-price-router.ts kèm unit test tại tests/unit/us3-dedup-routing.test.ts
- [x] T033 [US3] Viết bài kiểm thử tích hợp khử trùng và định tuyến giá tại tests/unit/us3-dedup-routing.test.ts

**Checkpoint**: User Story 3 hoàn thành độc lập - Tin rác và tin trùng lặp bị chặn 100%, tin hợp lệ được gắn đích đến chính xác.

---

## Phase 6: User Story 4 - Chuyển Tiếp Tự Động 2 Pha & Hoàn Tất Chu Trình (Priority: P4)

**Goal**: Pha 1 mở Native Forward Modal gửi media và chờ Toast; Pha 2 mở nhóm con tiêm văn bản đã sửa SĐT kèm micro-jitter; quay về nhóm nguồn; chờ 10s đệm tĩnh lặng, chốt Checkpoint, emit Canonical Log Line `TWO_PHASE_FORWARD`.  
**Independent Test**: Chạy quy trình chuyển tiếp 2 Pha trên DOM giả lập; kiểm tra bắt được sự kiện Toast thành công, gõ text vào nhóm con đích, quay về nhóm nguồn, và giải phóng Mutex Lock sau 10s.

- [x] T034 [US4] Hiện thực Node 8: Pha 1 - Tương tác Native Forward Modal chia sẻ media và chờ Toast thành công tại src/nodes/n08-forward-automator.ts kèm unit test tại tests/unit/us4-forward-drain.test.ts
- [x] T035 [US4] Hiện thực Node 9: Pha 2 - Chuyển nhóm con, tiêm text đã sửa SĐT với micro-jitter, quay về nhóm nguồn tại src/nodes/n09-text-injector.ts kèm unit test tại tests/unit/us4-forward-drain.test.ts
- [x] T036 [US4] Hiện thực Node 10: Đệm tĩnh lặng 10s Inactivity, ghi Checkpoint, giải phóng Mutex Lock và phát Canonical Log Line hoàn tất chu trình tại src/nodes/n10-committer-drain.ts kèm unit test tại tests/unit/us4-forward-drain.test.ts
- [x] T037 [US4] Viết bài kiểm thử tích hợp luồng chuyển tiếp 2 pha tại tests/unit/us4-forward-drain.test.ts

**Checkpoint**: User Story 4 hoàn thành độc lập - Chu trình tự động hóa khép kín từ đầu đến cuối sẵn sàng vận hành.

---

## Phase 7: Polish & Cross-Cutting Concerns (E2E Verification & CI)

**Purpose**: Chẩn đoán sức khỏe bộ chọn, xử lý Captcha qua Circuit Breaker, kịch bản Playwright E2E nạp Chromium MV3, cấu hình vòng đời kiểm thử Bun và kiểm toán toàn diện.

- [x] T038 [P] Xây dựng bộ chẩn đoán tự động kiểm tra sức khỏe bộ chọn SelectorHealthChecker tại src/contracts/selectors.ts
- [x] T039 Tích hợp Circuit Breaker tự dừng khi Zalo yêu cầu Captcha và phát Canonical Log Line cảnh báo tại src/nodes/n02-queue-manager.ts
- [x] T040 [P] Xây dựng fixture test bootstrap nạp Chromium Persistent Context trong tests/e2e/fixtures.ts
- [x] T041 [P] Viết kịch bản kiểm thử E2E Playwright trên file mock Zalo tại tests/e2e/two-phase-forward.spec.ts
- [x] T042 [P] Viết kịch bản kiểm thử E2E phục hồi sau F5 tại tests/e2e/extension-lifecycle.spec.ts
- [x] T043 Cấu hình trọn bộ vòng đời script kiểm thử trong package.json (`test:unit`, `test:integration`, `test:e2e`, `test`)
- [x] T044 Thực thi kiểm toán mã nguồn toàn diện với Biome (`bun run check`) và chạy toàn bộ Vitest + Playwright test suites với kết quả 0 lỗi

---

## Dependencies & DAG Execution Graph

```
T001 (Bun/WXT) ──┬──> T002 (TS Strict)
                 ├──> T003 (Biome)
                 ├──> T004 (Vitest)
                 ├──> T005 (Playwright MV3)
                 └──> T006 (Mock DOM Fixture)
                           │
                           v
T007 (Dexie DB) ─┬──> T008 (Queue Repo)
                 ├──> T009 (Dedup Repo)
                 ├──> T010 (Log Repo Ring-Buffer)
                 ├──> T011 (Correlation Context)
                 ├──> T012 (Wide Event Logger)
                 ├──> T013 (Zod Schemas)
                 ├──> T014 (Messaging IPC)
                 ├──> T015 (Selectors 3-Tier)
                 ├──> T016 (React DOM Bridge)
                 └──> T017 (Pacing Guard)
                           │
                           v (Foundational & Observability Ready)
             +-------------+-------------+
             |                           |
             v                           v
     [US1: Core MVP]             [US2: Collection]
     T018 (SW Keep-Awake)        T024 (N01 Sidebar)
     T019 (Options + Export Log) T025 (N02 Queue Mgr)
     T020 (Floating Panel)       T026 (N03 Switcher)
     T021 (Shadow Root UI)       T027 (N04 Delta)
     T022 (Emergency Stop)       T028 (N05 Aggregator)
     T023 (US1 Tests)            T029 (US2 Tests)
                                         │
                                         v
                                 [US3: Dedup & Price]
                                 T030 (Crypto Hash)
                                 T031 (N06 Dedup Gate)
                                 T032 (N07 Price Router)
                                 T033 (US3 Tests)
                                         │
                                         v
                                 [US4: 2-Phase Forward]
                                 T034 (N08 Forward Pha 1)
                                 T035 (N09 Inject Pha 2)
                                 T036 (N10 Committer 10s)
                                 T037 (US4 Tests)
                                         │
                                         v
                                 [Phase 7: Polish & CI]
                                 T038 (Selector Health)
                                 T039 (Captcha Breaker)
                                 T040 (E2E Fixture Bootstrap)
                                 T041 (E2E Mock Forward)
                                 T042 (E2E F5 Recovery)
                                 T043 (Bun CI Scripts)
                                 T044 (Audit Zero Error)
```

---

## Parallel Execution Opportunities

- **Setup Phase (Phase 1)**: T002, T003, T004, T005, T006 có thể thực thi song song hoàn toàn vì không giao thoa tệp.
- **Foundational Phase (Phase 2)**: T008, T009, T010, T011, T012, T013, T014, T015, T016, T017 có thể thực thi song song sau khi T007 hoàn tất.
- **User Story 1**: T019 (Options Page) và T020 (Floating Panel) có thể phát triển song song.
- **User Story 3**: T030 (Crypto Hash) có thể phát triển song song với các module logic khác.
- **Phase 7 (Polish & E2E)**: T038, T040, T041, T042 có thể thực thi song song độc lập.
