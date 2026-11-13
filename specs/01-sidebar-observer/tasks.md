---
template_id: "tasks-template"
version: "2.0.0"
command: "/speckit-tasks"
description: "Task list template for feature implementation following Direct XML & YAML hybrid standard"
output_artifact: "specs/01-sidebar-observer/tasks.md"
task_format: "- [ ] [TaskID] [P?] [Story?] Description with exact file path"
---

# Tasks: 01-sidebar-observer (Background Sidebar Mutation Observer & Whitelist Stream Ingestion Engine)

<context_anchor>
input_dir: "/specs/01-sidebar-observer/"
required_prerequisites:
  - "plan.md"
  - "spec.md"
optional_prerequisites:
  - "checklist.md"
tests_policy: "MANDATORY - companion unit test for every task per constitution"
organization: "Grouped by user story for independent implementation and testing"
guidance_rules:
  - ".agents/rules/directory-governance.md"
</context_anchor>

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, zero file intersection)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

## Path Conventions

- Single project structure: `src/` and `tests/` at repository root
- Path alias: `@/*` maps to `src/*`
- UI Module Boundary (Layer 1 & 2): `src/screens/sidebar-observer/` (Max Depth <= 2)

---

## Phase 1: Setup & Contracts (Shared Infrastructure)

**Purpose**: Chuẩn hóa interface contracts, ma trận selector DOM 3 tầng và schemas Zod làm nền tảng bất biến cho toàn bộ Node 01.

- [x] T001 [P] Chuẩn hóa ma trận selector DOM 3 tầng bám sát snapshot `Temps/zalo-element/sidebar.html` trong `src/contracts/selectors.ts` kèm unit tests trong `tests/unit/selectors.test.ts`
- [x] T002 [P] Khai báo bổ sung các Zod schemas (`WhitelistGroupItem`, `DiscoveredGroupItem`, `GroupDetectedEvent`, `N01Config`) trong `src/contracts/schemas.ts` kèm unit tests trong `tests/unit/schemas.test.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Các tiện ích thuần túy (pure utilities) và fixtures kiểm thử bắt buộc phải hoàn thành trước khi hiện thực logic observer.

<gate_rule>
gate: "FOUNDATIONAL_BLOCKER"
severity: "CRITICAL"
rule: "No user story work may begin until Phase 2 completes and tests pass"
</gate_rule>

- [ ] T003 [P] Thiết lập DOM snapshot fixture từ `Temps/zalo-element/sidebar.html` phục vụ mock testing trong `tests/fixtures/sidebar-dom.fixture.ts`
- [x] T004 [P] Xây dựng hàm tiện ích thuần túy chuẩn hóa chuỗi `normalizeZaloText` (Unicode NFC, loại bỏ `&nbsp;`, zero-width space, gom khoảng trắng) trong `src/utils/text-normalizer.ts` kèm companion tests trong `tests/unit/text-normalizer.test.ts`
- [ ] T005 [P] Xây dựng hàm tiện ích trích xuất số lượng từ Font Icon Zalo `extractUnreadBadgeCount` (`fa-1_24_Line` đến `fa-5_Plus_24_Line` và `--dot`) trong `src/utils/badge-extractor.ts` kèm companion tests trong `tests/unit/badge-extractor.test.ts`

<checkpoint>
phase: "Phase 2: Foundational"
exit_condition: "Toàn bộ utilities và contracts sẵn sàng, 100% tests vượt qua với exit code 0"
</checkpoint>

---

## Phase 3: User Story 1 - Giám Sát & Bóc Tách DOM Thực Tế Phát Hiện Tin Mới (Priority: P1) 🎯 MVP

**Goal**: Bóc tách chính xác tin nhắn mới từ DOM Zalo Web theo cấu trúc thực tế `sidebar.html`, loại bỏ toàn bộ selector suy đoán cũ và khớp Whitelist tự động.

**Independent Test**: Chạy bài test trích xuất DOM offline từ fixture `sidebar-dom.fixture.ts`: Xác nhận trích xuất đúng `groupId`, `groupName` loại bỏ `&nbsp;`, `unreadCount = 5`, và kích hoạt callback `onNewMessage`.

### Tests for User Story 1

- [ ] T006 [P] [US1] Xây dựng bộ test hợp đồng và bóc tách DOM thực tế (GATE-N01-02) trong `tests/unit/n01-sidebar-observer-extraction.test.ts`

### Implementation for User Story 1

- [ ] T007 [US1] Tái cấu trúc bộ bóc tách thẻ hội thoại trong `src/nodes/n01-sidebar-observer.ts` sử dụng selector chuẩn hóa 3 tầng (`anim-data-id`, `div-b16.conv-item-title__name .truncate`, `data-ava-uid`) thay thế các selector giả định cũ
- [ ] T008 [US1] Hiện thực cơ chế Hợp nhất đa tín hiệu (Multi-Signal Fusion: badge counter, dot badge, unread message class, bold time, snippet delta) trong `src/nodes/n01-sidebar-observer.ts`
- [ ] T009 [US1] Hiện thực thuật toán đối chiếu Whitelist `matchWhitelist` theo quy tắc `EXACT` và `CONTAINS` kèm ghi nhận viễn trắc `totalIgnoredNonWhitelist` trong `src/nodes/n01-sidebar-observer.ts`

<checkpoint>
phase: "Phase 3: User Story 1"
exit_condition: "User Story 1 hoàn thành độc lập, vượt qua toàn bộ assertions trong GATE-N01-02"
</checkpoint>

---

## Phase 4: User Story 2 - Gom Cụm Khử Rung (Debounce Buffer) & Khử Trùng Lặp Lũy Đẳng (Priority: P2)

**Goal**: Đảm bảo hiệu năng trình duyệt đạt 60 FPS khi có bão tin nhắn qua cửa sổ đệm Debounce 300ms và không sinh bản ghi trùng lặp trong hàng đợi Dexie.

**Independent Test**: Kích hoạt liên tiếp 20 đột biến DOM trên 1 nhóm trong 150ms; sau 300ms yên tĩnh chỉ có đúng 1 bản ghi trong bảng `group_dispatch_queue` và trường `lastActiveAt` được cập nhật chính xác.

### Tests for User Story 2

- [ ] T010 [P] [US2] Xây dựng bộ test kiểm chứng cơ chế Debounce 300ms và Idempotent Enqueueing (GATE-N01-01, GATE-N01-03) trong `tests/unit/n01-sidebar-observer-debounce.test.ts`

### Implementation for User Story 2

- [ ] T011 [US2] Hiện thực cơ chế Debounce Buffer gom cụm đột biến DOM 300ms kết hợp `requestAnimationFrame` microtask chunking trong `src/nodes/n01-sidebar-observer.ts`
- [ ] T012 [US2] Hiện thực cơ chế Khử trùng lặp lũy đẳng (Idempotent Enqueueing) ghi nhận vào Dexie bảng `group_dispatch_queue` (chỉ cập nhật `lastActiveAt` nếu đang `PENDING` hoặc `PROCESSING`) trong `src/nodes/n01-sidebar-observer.ts`

<checkpoint>
phase: "Phase 4: User Story 2"
exit_condition: "User Stories 1 và 2 đều hoạt động đồng bộ, vượt qua GATE-N01-01 và GATE-N01-03"
</checkpoint>

---

## Phase 5: User Story 3 - Khám Phá & Chọn Nhóm Tự Động Từ Sidebar (Priority: P3)

**Goal**: Cung cấp tính năng quét tự động danh mục nhóm trên DOM Sidebar và cấu trúc giao diện module phẳng 4 thành phần tại `src/screens/sidebar-observer/` với thao tác 1-Click thêm/gỡ nhóm.

**Independent Test**: Gọi hàm `discoverSidebarGroups` trên mock DOM, kiểm chứng danh sách trả về đầy đủ các trường `DiscoveredGroupItem[]`. Thao tác thêm/gỡ trên `WhitelistDrawer.tsx` cập nhật reactive signal trong `sidebar-observer.signals.ts` và lưu thành công vào Dexie `app_settings`.

### Tests for User Story 3

- [ ] T013 [P] [US3] Xây dựng bộ test kiểm chứng hàm quét khám phá nhóm `discoverSidebarGroups` và đồng bộ Whitelist (GATE-N01-06) trong `tests/unit/n01-sidebar-discovery.test.ts`
- [ ] T014 [P] [US3] Xây dựng bộ test render và tương tác Signal cho màn hình `SidebarObserverScreen` trong `tests/unit/n01-sidebar-screen.test.ts`

### Implementation for User Story 3

- [ ] T015 [US3] Hiện thực hàm quét toàn diện danh mục nhóm Sidebar `discoverSidebarGroups` trong `src/nodes/n01-sidebar-observer.ts`
- [ ] T016a [P] [US3] Khai báo compile-time types và interfaces cho UI trong `src/screens/sidebar-observer/sidebar-observer.types.ts`
- [ ] T016b [P] [US3] Xây dựng reactive signals store quản trị trạng thái nhóm và cấu hình trong `src/screens/sidebar-observer/sidebar-observer.signals.ts`
- [ ] T016c [P] [US3] Xây dựng component drawer quản lý danh mục Whitelist ẩn/hiện trong `src/screens/sidebar-observer/components/WhitelistDrawer.tsx`
- [ ] T016d [P] [US3] Xây dựng component card hiển thị trạng thái viễn trắc hàng đợi và kết nối trong `src/screens/sidebar-observer/components/TelemetryStatusCard.tsx`
- [ ] T016e [US3] Hiện thực View Container chính `src/screens/sidebar-observer/SidebarObserverScreen.tsx` tích hợp các components nội bộ, kết nối Signals và nút "Quét Nhóm Từ Sidebar" (phụ thuộc T016a, T016b, T016c, T016d)
- [ ] T017 [US3] Hiện thực cơ chế Hot-Sync Whitelist: Lưu cấu hình vào Dexie `app_settings` và tự động gọi `SidebarObserver.updateWhitelist()` tức thì không cần reload trang (GATE-N01-04)

<checkpoint>
phase: "Phase 5: User Story 3"
exit_condition: "Chức năng khám phá và module UI phẳng src/screens/sidebar-observer/ hoạt động hoàn hảo, tuân thủ directory-governance.md"
</checkpoint>

---

## Phase 6: User Story 4 - Tự Phục Hồi Kết Nối & Giám Sát Viễn Trắc Toàn Diện (Priority: P4)

**Goal**: Tự động gắn kết (Auto-Attach), tự phục hồi kết nối khi React unmount/re-mount container `#conversationList` và đồng bộ viễn trắc hàng đợi (`IDLE`, `PROCESSING`, `DRAINED`) sang `TelemetryStatusCard.tsx`.

**Independent Test**: Mô phỏng hủy container cũ và tạo container mới, observer tự động tái kết nối trong `<= 500ms`. Đồng bộ viễn trắc qua `BroadcastChannel` phản ánh chính xác trạng thái hàng đợi trên reactive signal.

### Tests for User Story 4

- [ ] T018 [P] [US4] Xây dựng bộ test kiểm chứng Auto-Attach timeout 30s và Self-Healing Reconnect khi SPA re-mount trong `tests/unit/n01-sidebar-observer-resilience.test.ts`

### Implementation for User Story 4

- [ ] T019 [US4] Hoàn thiện cơ chế Auto-Attach và Self-Healing Reconnect (`!document.contains(container)`) với thời gian tái kết nối `<= 500ms` trong `src/nodes/n01-sidebar-observer.ts`
- [ ] T020 [US4] Hiện thực phát sóng `N01TelemetrySnapshot` qua `BroadcastChannel('n01_telemetry_channel')` đồng bộ 3 trạng thái hàng đợi `IDLE`, `PROCESSING`, `DRAINED` sang `src/screens/sidebar-observer/sidebar-observer.signals.ts` và component `TelemetryStatusCard.tsx` (GATE-N01-05)
- [ ] T021 [US4] Tích hợp ghi log cấu trúc Wide-Event Telemetry có `correlationId` vào bảng `system_logs` cho mỗi chu kỳ trích xuất và phát hiện nhóm trong `src/nodes/n01-sidebar-observer.ts`

<checkpoint>
phase: "Phase 6: User Story 4"
exit_condition: "Toàn bộ 4 User Stories hoàn tất độc lập và liên kết chặt chẽ"
</checkpoint>

---

## Phase 7: Polish & Integration Verification

**Purpose**: Rà soát tích hợp hệ thống, dọn dẹp mã nguồn và kiểm chứng cơ học toàn diện.

- [ ] T022 [P] Cập nhật kết nối và truyền `GroupDetectedEvent` từ `src/nodes/n01-sidebar-observer.ts` sang `src/orchestrator.ts`
- [ ] T023 [P] Chạy toàn diện bộ kiểm thử đơn vị `vitest run tests/unit/n01-*` và xác nhận 100% tests pass (exit code 0)
- [ ] T024 [P] Chạy kiểm tra định dạng và phân tích tĩnh Biome bằng lệnh `biome check .` bảo đảm 0 lỗi cú pháp

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup & Contracts (Phase 1)**: Không phụ thuộc, có thể khởi chạy ngay.
- **Foundational (Phase 2)**: Phụ thuộc vào Phase 1 hoàn tất — CHẶN (BLOCK) toàn bộ các User Stories tiếp theo.
- **User Story 1 (Phase 3 - P1 MVP)**: Phụ thuộc vào Phase 2 hoàn tất.
- **User Story 2 (Phase 4 - P2)**: Phụ thuộc vào US1 (Phase 3).
- **User Story 3 (Phase 5 - P3)**: Phụ thuộc vào US1 (Phase 3).
- **User Story 4 (Phase 6 - P4)**: Phụ thuộc vào US1 & US2.
- **Polish & Verification (Phase 7)**: Phụ thuộc vào toàn bộ User Stories (Phase 3-6) hoàn tất.

### Parallel Opportunities

- **Trong Phase 1**: T001 (`src/contracts/selectors.ts`) và T002 (`src/contracts/schemas.ts`) chạy song song `[P]`.
- **Trong Phase 2**: T003 (`tests/fixtures/`), T004 (`src/utils/text-normalizer.ts`), T005 (`src/utils/badge-extractor.ts`) chạy song song `[P]`.
- **Trong Phase 5 (US3 UI Module)**: T016a (`sidebar-observer.types.ts`), T016b (`sidebar-observer.signals.ts`), T016c (`WhitelistDrawer.tsx`), T016d (`TelemetryStatusCard.tsx`) đều độc lập tệp (Zero File Intersection) nên chạy song song `[P]`.
- **Trong Phase 7**: T022, T023, T024 thực thi độc lập `[P]`.

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Hoàn tất Phase 1: Setup & Contracts (T001, T002).
2. Hoàn tất Phase 2: Foundational (T003, T004, T005).
3. Hoàn tất Phase 3: User Story 1 (T006, T007, T008, T009).
4. **DỪNG LẠI & KIỂM CHỨNG**: Chạy `vitest run tests/unit/n01-sidebar-observer-extraction.test.ts`. Xác nhận bóc tách DOM thực tế thành công 100%.

### Incremental Delivery

1. Thêm User Story 2: Debounce Buffer 300ms và Idempotent Enqueueing -> Chạy test kiểm chứng bão tin nhắn.
2. Thêm User Story 3: Quét khám phá nhóm và module UI phẳng `src/screens/sidebar-observer/` 1-Click -> Kiểm chứng giao diện và Dexie sync.
3. Thêm User Story 4: Auto-Attach, Self-Healing Reconnect và Telemetry Snapshot -> Kiểm chứng tự phục hồi và đồng bộ trạng thái hàng đợi.
4. Chạy toàn bộ test suites và Biome check ở Phase 7 trước khi bàn giao.

