# Implementation Plan: Zalo Personal Automation 24/7

**Branch**: `001-zalo-personal-automation` | **Date**: 2026-11-10 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/001-zalo-personal-automation/spec.md` and Architecture Decision Record `adr_001_framework_toolchain_zalo_extension.md`.

---

## Summary

Triển khai tiện ích mở rộng Chrome Extension (Manifest V3) phục vụ tự động hóa thu thập, biên tập và phân phối tin nhắn Zalo đa nhóm 24/7 cho cá nhân (Solo Operator). Hệ thống vận hành dựa trên khung kiến trúc **WXT Framework** kết hợp **TypeScript Strict Mode**, giao diện nổi tinh gọn **Preact + Signals (~3kB)** cô lập hoàn toàn trong Shadow DOM, cơ sở dữ liệu cục bộ **Dexie.js (IndexedDB 5 bảng)**, và cơ chế chuyển tiếp 2 Pha (Pha 1: Native Forward Modal, Pha 2: Contextual Text Injection với Micro-Jitter).

---

## Technical Context

- **Language/Version**: TypeScript 5.x (Strict Mode `strict: true`, `noImplicitAny: true`, `exactOptionalPropertyTypes: true`).
- **Runtime & Bundler**: [Bun](https://bun.sh/) (Package Manager & Script Runner) + [WXT](https://wxt.dev/) (Vite-based Next-gen WebExtension Framework).
- **Primary Dependencies**:
  - UI: [Preact](https://preactjs.com/) (`v10.x`, `~3kB`), [Preact Signals](https://preactjs.com/guide/v10/signals/) (`@preact/signals`), Tailwind CSS (`cssInjectionMode: 'ui'`).
  - Storage: [Dexie.js](https://dexie.org/) (`v4+`), `@wxt-dev/storage`.
  - IPC Messaging: `@webext-core/messaging` + Native `chrome.runtime.Port`.
  - Validation: [Zod](https://zod.dev/) (`v3.x`).
- **Storage Engine**: IndexedDB trên origin `https://chat.zalo.me` gồm 5 bảng: `app_settings`, `group_checkpoints`, `group_dispatch_queue`, `entities`, `system_logs`.
- **Testing Toolchain**:
  - Unit/Integration: [Vitest](https://vitest.dev/) + `fake-indexeddb` + `happy-dom` (Chạy offline 100% trong RAM `< 1s`).
  - E2E Testing: [Playwright](https://playwright.dev/) với Chromium Persistent Context và Mock Zalo DOM Fixture (`mock-zalo.html`).
- **Code Quality**: [Biome](https://biomejs.dev/) (`biome.json`), thay thế toàn bộ ESLint và Prettier.
- **Target Platform**: Chromium-based Desktop Browsers (Chrome 120+, Brave, Edge) Manifest V3.
- **Project Type**: WebExtension Manifest V3 (3 Entrypoints: Service Worker, Content Script, Options Page).
- **Performance Goals**:
  - Dev Rebuild HMR: `< 150ms`.
  - Cold Start Content Script: `< 500ms`.
  - IndexedDB Chỉ mục truy vấn: `< 2ms` per read/write.
  - RAM Footprint phụ trội trên tab Zalo: `< 20MB`.
  - Content Script Bundle Size: `< 60kB`.
- **Constraints**:
  - Tuân thủ 100% Manifest V3 CSP (Zero `eval`, Zero inline script, Zero remote scripts).
  - Khóa điều khiển UI: **Single Mutex Lock FIFO Queue** (Zero Concurrency trên DOM).
  - Vòng đời tài nguyên: Quản lý qua `ContentScriptContext` (`ctx`) để chống rò rỉ bộ nhớ khi reload.
  - Keep-Awake 24/7: Chu kỳ Heartbeat Port 20s và `chrome.power.requestKeepAwake('display')`.

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Mã Tiêu Chuẩn | Nội Dung Tiêu Chuẩn Trong Hiến Chương | Trạng Thái | Minh Chứng Thẩm Định Trong Bản Kế Hoạch |
| :--- | :--- | :---: | :--- |
| **I. Andrew Principles** | Radical Parsimony, Zero-Assumption, AST Invariance, Mechanical Determinism | **PASS** | Sử dụng Preact Signals ~3kB thay vì React; phân rã 10 Node rõ ràng; kiểm thử tự động với Vitest + fake-indexeddb. |
| **NEG-001** | CẤM gọi API ngầm (`zca-js`, `zlapi`) | **PASS** | 100% tương tác thu thập và chuyển tiếp thực hiện qua DOM Zalo Web của tài khoản đăng nhập hợp lệ. |
| **NEG-002** | CẤM vi phạm CSP MV3 (Không `eval`, không inline script) | **PASS** | WXT và Vite biên dịch mã tĩnh đóng gói cục bộ hoàn toàn; không dùng thư viện ngoài bundle. |
| **NEG-003** | CẤM thực thi song song thao tác UI (Single Mutex FIFO) | **PASS** | Node 2 điều phối một hàng chờ đơn có cờ `isProcessing` và khóa Mutex tuần tự tuyệt đối. |
| **NEG-004** | CẤM rò rỉ CSS & Event ra khỏi Shadow DOM | **PASS** | Sử dụng `createShadowRootUi` với `cssInjectionMode: 'ui'` và `isolateEvents: ['keydown', 'keyup', 'keypress', 'click']`. |
| **NEG-005** | BẮT BUỘC Micro-Jitter (1000ms - 2000ms) & Circuit Breaker | **PASS** | Module `pacing-guard.ts` chèn random delay trước mọi tương tác; Circuit Breaker tạm dừng khi gặp Captcha. |
| **NEG-006** | CẤM nuốt ngoại lệ (Zero Silent Error Swallowing) | **PASS** | Mọi ngoại lệ được đóng gói ghi vào bảng `system_logs` (Ring-Buffer) và phản hồi thị giác lên Floating Panel. |
| **GATE-01..04** | Biome, Vitest test-first, Playwright mock E2E, ADR traceability | **PASS** | Toàn bộ các công cụ và quy trình kiểm thử đều được tích hợp đầy đủ. |

---

## Project Structure

### Documentation (Feature 001)

```text
specs/001-zalo-personal-automation/
├── spec.md                     # Đặc tả chức năng, User Stories, Boundaries (SSOT)
├── plan.md                     # Kế hoạch kiến trúc 5 tầng, Data Model, Topology (File này)
├── checklist.md                # Danh mục kiểm tra thẩm định chất lượng yêu cầu
├── checklists/
│   └── requirements.md         # Bảng kiểm tra chất lượng spec trước khi lập kế hoạch
└── tasks.md                    # Đồ thị nhiệm vụ DAG phân rã chi tiết kèm mã [P]
```

### Source Code Layout (Repository Root)

```text
zalo-personal-automation/
├── entrypoints/
│   ├── background.ts                 # Service Worker: Keep-Awake Heartbeat Port (20s), Watchdog, chrome.power
│   ├── zalo.content/                 # Content Script chính chạy trên https://chat.zalo.me/*
│   │   ├── index.tsx                 # WXT main(ctx), gắn createShadowRootUi, khởi động Node 1 & Node 2
│   │   ├── style.css                 # Tailwind CSS đóng gói độc lập nhúng vào Shadow Root
│   │   └── FloatingPanel.tsx         # Preact Component: Trạng thái Worker, Queue Count, Nút Dừng Khẩn Cấp
│   └── options/                      # Giao diện Quản trị & Cấu hình Extension
│       ├── index.html                # HTML entry cho Options
│       ├── main.tsx                  # Preact App: Whitelist Config, Price Route Matrix, Log Viewer
│       └── style.css
├── src/
│   ├── contracts/                    # HỢP ĐỒNG DỮ LIỆU & SCHEMA KIỂM DUYỆT (Zod)
│   │   ├── schemas.ts                # Zod schemas: EntityBundle, GroupCheckpoint, PriceRouteRule, AppSettings
│   │   ├── messaging.ts              # @webext-core/messaging ProtocolMap (Type-safe IPC giữa SW và CS)
│   │   └── selectors.ts              # Registry toàn bộ DOM Selectors Zalo với Fallback 3 Tầng
│   ├── db/                           # TẦNG LƯU TRỮ CỤC BỘ (Dexie.js IndexedDB)
│   │   ├── database.ts               # Khai báo ZaloAutomationDatabase (5 bảng chuẩn)
│   │   ├── queue-repo.ts             # Thao tác CRUD hàng chờ group_dispatch_queue + Recovery sau F5
│   │   ├── dedup-repo.ts             # Truy vấn khử trùng lặp 2 lớp (entityKey + contentHash) & Rolling 30d TTL
│   │   └── log-repo.ts               # Ghi và tự động xoay vòng Ring-Buffer bảng system_logs
│   ├── nodes/                        # 10 NODE CHỨC NĂNG NGHIỆP VỤ (Ánh xạ 5 Tầng Kiến Trúc)
│   │   ├── n01-sidebar-observer.ts   # Node 1: MutationObserver bất đồng bộ theo dõi #conversationList
│   │   ├── n02-queue-manager.ts      # Node 2: Điều phối Single Mutex FIFO Queue + Khôi phục khi F5
│   │   ├── n03-chat-switcher.ts      # Node 3: Mở nhóm nguồn trên DOM + Neo đáy khung chat
│   │   ├── n04-delta-stitcher.ts     # Node 4: Khớp Checkpoint, bỏ qua nút 99+, quét 5-10 tin đáy
│   │   ├── n05-bundle-aggregator.ts  # Node 5: Gom cụm Media + Text theo senderId (cửa sổ 15s, debounce 2-3s)
│   │   ├── n06-dedup-gate.ts         # Node 6: Thẩm định cấu trúc + Kiểm tra trùng lặp 2 lớp 30 ngày
│   │   ├── n07-price-router.ts       # Node 7: Bóc tách SĐT lách luật + Khoảng giá -> Tối đa <= 2 Nhóm Con
│   │   ├── n08-forward-automator.ts  # Node 8: Pha 1 - Mở Native Forward Modal -> Chọn nhóm con -> Chờ Toast
│   │   ├── n09-text-injector.ts      # Node 9: Pha 2 - Chuyển Nhóm Con -> Gõ editedText + Jitter -> Về Nhóm Nguồn
│   │   └── n10-committer-drain.ts    # Node 10: Chờ đệm tĩnh lặng 10s -> Ghi Checkpoint -> Giải phóng Mutex Lock
│   └── utils/
│       ├── react-dom-bridge.ts       # setReactInputValue(), dispatchEvent() tương thích React 18 Zalo
│       ├── pacing-guard.ts           # randomJitter(1000, 2000), microDelay(30, 80) & Circuit Breaker
│       ├── crypto-hash.ts            # Băm SHA-256 chuẩn Web Crypto API (crypto.subtle.digest)
│       ├── correlation.ts            # Quản lý ngữ cảnh Correlation ID truy vết chu trình
│       └── logger.ts                 # Logger phát Wide Event / Canonical Log Line kèm Data Masking
├── tests/
│   ├── fixtures/
│   │   └── mock-zalo.html            # Mẫu DOM HTML tĩnh Zalo Web giả lập phục vụ E2E
│   ├── unit/                         # Vitest + fake-indexeddb (Pure logic, Regex, Zod trong < 1s)
│   │   ├── db.test.ts
│   │   ├── bundle-aggregator.test.ts
│   │   ├── dedup-gate.test.ts
│   │   ├── price-router.test.ts
│   │   └── logger.test.ts
│   ├── integration/                  # Vitest + fake-indexeddb (IPC + Dexie Repositories)
│   │   ├── queue-repo.test.ts
│   │   ├── dedup-repo.test.ts
│   │   └── messaging-ipc.test.ts
│   └── e2e/                          # Playwright Chromium Persistent Context Extension Tests
│       ├── extension-lifecycle.spec.ts
│       └── two-phase-forward.spec.ts
├── biome.json                        # Cấu hình Biome (Linter & Formatter Rust duy nhất)
├── wxt.config.ts                     # Cấu hình WXT: Manifest V3, Permissions, Modules, Path Aliases
├── tsconfig.json                     # Cấu hình TypeScript Strict Mode
├── vitest.config.ts                  # Cấu hình Vitest với setupFiles: ['fake-indexeddb/auto']
├── playwright.config.ts              # Cấu hình Playwright nạp build extension (.output/chrome-mv3)
└── package.json                      # Quản lý script (bun test:unit, test:integration, test:e2e)
```

---

## Module Topology & 5-Layer Architectural Pipeline

10 Node nghiệp vụ được phân bổ chặt chẽ theo mô hình đường ống 5 tầng đơn hướng (Unidirectional 5-Layer Pipeline):

```
+-----------------------------------------------------------------------------------+
| TẦNG 1: QUAN SÁT (Observation Layer)                                              |
| [Node 1: Sidebar Observer] -- Bắt sự kiện DOM #conversationList (Zalo Web)        |
+-----------------------------------------+-----------------------------------------+
                                          | Enqueue nhóm nguồn phát sinh tin
                                          v
+-----------------------------------------------------------------------------------+
| TẦNG 2: ĐIỀU PHỐI & LƯU TRỮ (Orchestration & Storage Layer)                        |
| [Node 2: Queue Manager] <---> [Dexie.js IndexedDB: 5 Bảng]                         |
| (Single Mutex FIFO Lock, Khôi phục sau F5, Quản lý trạng thái IDLE/BUSY)          |
+-----------------------------------------+-----------------------------------------+
                                          | Khóa Mutex & Mở nhóm nguồn active
                                          v
+-----------------------------------------------------------------------------------+
| TẦNG 3: BÓC TÁCH & GOM CỤM (Ingestion & Aggregation Layer)                        |
| [Node 3: Chat Switcher] ---> [Node 4: Delta Stitcher] ---> [Node 5: Aggregator]   |
| (Mở nhóm, neo đáy DOM)      (Quét 5-10 tin đáy)           (Cửa sổ 15s, debounce)  |
+-----------------------------------------+-----------------------------------------+
                                          | Xuất EntityBundle hoàn chỉnh
                                          v
+-----------------------------------------------------------------------------------+
| TẦNG 4: THẨM ĐỊNH & ĐỊNH TUYẾN (Decision & Routing Layer)                          |
| [Node 6: Dedup Gate] -------------> [Node 7: Price Router]                        |
| (Lọc trùng 2 lớp: SĐT + SHA-256)    (Bóc tách khoảng giá -> <= 2 Nhóm Con Đích)   |
+-----------------------------------------+-----------------------------------------+
                                          | Gói tin hợp lệ sẵn sàng phân phối
                                          v
+-----------------------------------------------------------------------------------+
| TẦNG 5: TÁC ĐỘNG GIAO DIỆN & XÁC NHẬN (Execution & Committal Layer)                |
| [Node 8: Pha 1 Forward] ---> [Node 9: Pha 2 Text Inject] ---> [Node 10: Committer]|
| (Native Forward Modal)       (Gõ text biên tập + Jitter)      (Chờ 10s, Checkpoint)|
+-----------------------------------------------------------------------------------+
```

---

## WXT 3 Entrypoints Architecture

### 1. `entrypoints/background.ts` (Service Worker)
- **Vòng đời & Giữ thức (Keep-Awake 24/7)**:
  - Khởi tạo cổng kết nối `chrome.runtime.onConnect` lắng nghe từ Content Script.
  - Phản hồi chu kỳ Heartbeat Ping-Pong mỗi 20 giây để giữ Service Worker không bị Chrome hủy.
  - Kích hoạt `chrome.power.requestKeepAwake('display')` để hệ điều hành không đưa màn hình/tab vào chế độ ngủ đông.
  - Cung cấp Watchdog Timer (60s): Nếu sau 60s không nhận được tín hiệu Heartbeat từ Content Script trên tab Zalo, bắn cảnh báo thông báo trình duyệt (`chrome.notifications`).

### 2. `entrypoints/zalo.content/` (Content Script)
- **Môi trường thực thi**:
  - Chạy trên URL khớp `https://chat.zalo.me/*`.
  - Khởi tạo đối tượng `ContentScriptContext` (`ctx`) thông qua WXT:
    ```typescript
    export default defineContentScript({
      matches: ['https://chat.zalo.me/*'],
      cssInjectionMode: 'ui',
      async main(ctx) {
        // Tự động thu hồi timers/listeners khi extension reload
        const ui = await createShadowRootUi(ctx, {
          name: 'zalo-automation-floating-panel',
          position: 'overlay',
          anchor: 'body',
          isolateEvents: ['keydown', 'keyup', 'keypress', 'click'],
          onMount: (container) => {
            render(<FloatingPanel />, container);
          },
          onRemove: () => {
            // Cleanup UI
          }
        });
        ui.mount();
      }
    });
    ```
- **Preact Signals Floating Panel**:
  - Quản lý trạng thái phản ứng cực nhanh: `isProcessing = signal(false)`, `queueCount = signal(0)`, `workerStatus = signal('IDLE')`, `circuitBreakerState = signal('NORMAL')`.
  - Nút `Emergency Stop` kích hoạt thay đổi tức thì khóa Mutex và dừng mọi tác vụ UI đang chờ.

### 3. `entrypoints/options/` (Options UI Page)
- **Trang Quản trị & Cấu hình**:
  - Giao diện Preact + Tailwind CSS hiển thị trên tab riêng biệt (`chrome-extension://<id>/options.html`).
  - Cấu hình Whitelist nhóm nguồn (kèm tên nhóm và ID).
  - Cấu hình ma trận định tuyến giá: Phân khúc giá (Dưới 3 tỷ, 3-5 tỷ, 5-10 tỷ, Trên 10 tỷ) -> Danh sách tối đa 2 nhóm con đích.
  - Trình xem nhật ký Ring-Buffer: Tìm kiếm, lọc mức cảnh báo (`WARN`, `ERROR`, `CRITICAL`), và nút xuất file `system_logs.json`.

---

## Database Schema (Dexie.js 5 Tables & Contracts)

Database: `ZaloAutomationDatabase` kế thừa từ `Dexie`. Phiên bản 1:

```typescript
// src/db/database.ts
import Dexie, { type Table } from 'dexie';

export interface AppSetting {
  key: string;
  value: Record<string, unknown>;
  updatedAt: number;
}

export interface GroupCheckpoint {
  groupId: string;          // Primary key
  lastMessageId: string;
  lastSenderId: string;
  updatedAt: number;
}

export interface DispatchQueueItem {
  id?: number;             // Auto-increment primary key
  groupId: string;
  status: 'PENDING' | 'PROCESSING' | 'FAILED' | 'COMPLETED';
  retryCount: number;
  enqueuedAt: number;
}

export interface MessageEntity {
  id?: number;             // Auto-increment primary key
  entityKey: string;       // SĐT đã chuẩn hóa 10 số (chỉ mục)
  contentHash: string;     // SHA-256 của nội dung chuẩn hóa (chỉ mục)
  rawText: string;
  sourceGroupId: string;
  targetGroupIds: string[];
  createdAt: number;       // Timestamp ms (chỉ mục phục vụ Rolling 30d TTL)
}

export interface SystemLog {
  id?: number;             // Auto-increment primary key
  correlationId: string;   // UUID truy vết chu trình (Wide Event)
  operation: string;       // 'QUEUE_DISPATCH' | 'TWO_PHASE_FORWARD' | 'DOM_STAGING' | 'CIRCUIT_BREAKER'
  nodeId: string;          // N01 đến N10
  level: 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL';
  status: 'SUCCESS' | 'FAILURE' | 'DEGRADED';
  durationMs: number;      // Thời gian thực thi chu trình (ms)
  groupId: string;         // ID nhóm liên quan
  senderIdMasked: string;  // ID người gửi (đã che dấu)
  phoneMasked?: string;    // SĐT đã che dấu: '090****567'
  message: string;         // Tóm tắt kết quả
  errorPayload?: { code: string; message: string; stack?: string };
  timestamp: number;       // Timestamp ms (chỉ mục phục vụ Rolling 7d TTL)
}

export class ZaloAutomationDatabase extends Dexie {
  app_settings!: Table<AppSetting, string>;
  group_checkpoints!: Table<GroupCheckpoint, string>;
  group_dispatch_queue!: Table<DispatchQueueItem, number>;
  entities!: Table<MessageEntity, number>;
  system_logs!: Table<SystemLog, number>;

  constructor() {
    super('ZaloAutomationDB');
    this.version(1).stores({
      app_settings: 'key',
      group_checkpoints: 'groupId, updatedAt',
      group_dispatch_queue: '++id, groupId, status, enqueuedAt',
      entities: '++id, entityKey, contentHash, createdAt',
      system_logs: '++id, correlationId, operation, level, nodeId, status, timestamp'
    });
  }
}

export const db = new ZaloAutomationDatabase();
```

---

## Testing Architecture (Playwright MV3 & Test Lifecycle)

Nhằm đảm bảo tôn chỉ **Mechanical Determinism (Andrew Principles)** và kiểm thử 100% offline-first mà không gây nguy cơ khóa tài khoản Zalo thật, dự án thiết lập hệ thống kiểm thử tự động 4 tầng phân lập:

```
tests/
├── fixtures/        # Mock DOM Snapshots: mock-zalo.html (Sidebar, Message List, Forward Modal, Toast)
├── unit/            # Vitest + fake-indexeddb (Pure logic: Regex SĐT, bóc tách giá, gom cụm 15s)
├── integration/     # Vitest + fake-indexeddb (Dexie Repositories, IPC Protocol, Mutex State transitions)
└── e2e/             # Playwright Chromium Persistent Context (Load extension bundle thật)
```

### 1. Cấu Hình & Khởi Tạo Playwright Extension Context
Playwright khởi chạy Chromium Persistent Context với cờ nạp trực tiếp thư mục build của WXT (`.output/chrome-mv3`):

```typescript
// tests/e2e/fixtures.ts
import { test as base, chromium, type BrowserContext } from '@playwright/test';
import path from 'node:path';

export const test = base.extend<{
  context: BrowserContext;
  extensionId: string;
}>({
  context: async ({}, use) => {
    const pathToExtension = path.resolve('.output/chrome-mv3');
    const context = await chromium.launchPersistentContext('', {
      headless: false, // Bắt buộc false đối với Extension testing trong Chromium
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
        '--no-sandbox'
      ]
    });
    await use(context);
    await context.close();
  },
  extensionId: async ({ context }, use) => {
    let [background] = context.serviceWorkers();
    if (!background) {
      background = await context.waitForEvent('serviceworker');
    }
    const extensionId = background.url().split('/')[2];
    await use(extensionId);
  }
});
```

### 2. Kịch Bản E2E Ngoại Tuyến Trên `mock-zalo.html`
- Kịch bản `two-phase-forward.spec.ts`: Mở tệp fixture nội bộ `file://${fixturesPath}/mock-zalo.html`, mô phỏng sự kiện có tin nhắn mới tại `#conversationList`, kiểm tra extension phát hiện, kích hoạt mở Modal chuyển tiếp, chọn nhóm con đích, xác nhận Toast thành công, và inject văn bản vào nhóm con.
- Kịch bản `extension-lifecycle.spec.ts`: Kiểm tra việc nhấn F5 phục hồi hàng chờ `group_dispatch_queue` từ `PROCESSING` về `PENDING` mà không làm mất trạng thái.

### 3. Vòng Đời Kiểm Thử (Bun Scripts Lifecycle)
Trong `package.json`, các script kiểm thử được định nghĩa tường minh:
- `bun test:unit`: Chạy toàn bộ unit tests logic trong bộ nhớ RAM (`< 1s`).
- `bun test:integration`: Chạy kiểm thử tích hợp Dexie và IPC messaging (`< 2s`).
- `bun test:e2e`: Build extension qua `bun run build` rồi chạy bộ Playwright test suite.
- `bun test`: Chạy tuần tự Unit -> Integration -> E2E; đạt exit code 0 nhị phân trước khi commit.

---

## Observability & Logging Architecture (Wide Events & Multi-Sink)

Tuân thủ quy chuẩn **SSOT Logging Best Practices**, dự án loại bỏ hoàn toàn các chuỗi log rời rạc, vụn vặt và thay thế bằng mô hình **Wide Events / Canonical Log Lines**.

### 1. Triết Lý Canonical Log Lines
Mỗi chu trình nghiệp vụ lớn (ví dụ: `QUEUE_DISPATCH` xử lý 1 nhóm, `TWO_PHASE_FORWARD` chuyển tiếp 1 cụm tin) chỉ phát ra **DUY NHẤT 1 BẢN GHI SỰ KIỆN TOÀN DIỆN** khi kết thúc chu trình:

```
[2026-11-10T14:32:01.120Z] [INFO] [OPERATION=TWO_PHASE_FORWARD] [CORRELATION_ID=a8f9-4b12] 
  status=SUCCESS duration_ms=2340 source_group=g_12345 targets=[g_sub1, g_sub2] 
  sender=u_9988 phone_masked=090****567 media_count=4 retry_count=0 error=null
```

### 2. Correlation ID & Execution Context
Mỗi chu trình tạo ra một `correlationId` duy nhất (UUID v4) truyền xuyên suốt từ Node 1 đến Node 10 thông qua Async Context:

```typescript
// src/utils/correlation.ts
import { AsyncLocalStorage } from 'node:async_hooks'; // hoặc context wrapper tương đương trên browser

export class CorrelationContext {
  private static currentId: string | null = null;

  static generate(): string {
    return `corr_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  static runWith<T>(correlationId: string, fn: () => T): T {
    this.currentId = correlationId;
    try {
      return fn();
    } finally {
      this.currentId = null;
    }
  }

  static get(): string {
    return this.currentId || this.generate();
  }
}
```

### 3. Bảo Mật & Data Masking Engine
Nghiêm cấm ghi plain-text số điện thoại hoặc nội dung tin nhắn nhạy cảm vào log:
- **`maskPhoneNumber(phone: string)`**: `0901234567` -> `090****567`.
- **`sanitizeMessageText(text: string, maxLen = 80)`**: Rút ngắn văn bản, loại bỏ các cụm từ mật khẩu, mã OTP nếu vô tình xuất hiện.

### 4. Đa Tầng Sinks (Multi-Sink Architecture)
1. **Console Sink**: Format có màu sắc rõ ràng (Green: SUCCESS, Red: FAILURE, Yellow: DEGRADED) hiển thị trên Chrome DevTools.
2. **Dexie Ring-Buffer Sink**: Tự động lưu bản ghi Canonical Log Line vào bảng `system_logs`. Khi ghi bản ghi mới, kích hoạt tác vụ dọn dẹp cuốn chiếu:
   `await db.system_logs.where('timestamp').below(Date.now() - 7 * 86400 * 1000).delete();`
3. **Diagnostic JSON Exporter**: Trang Options cung cấp hàm `exportSystemLogsToJson()` cho phép xuất toàn bộ log của 7 ngày gần nhất thành file `.json` kèm thông tin phiên bản extension để dễ dàng chẩn đoán sự cố 24/7.
```

---

## Selector Registry & 3-Tier Fallback Strategy

Toàn bộ DOM Selectors của Zalo Web được tập trung tại `src/contracts/selectors.ts` với hàm giải quyết đa tầng `resolveSelector()`:

```typescript
// src/contracts/selectors.ts
export interface SelectorDefinition {
  name: string;
  tier1_semantic: string;   // data-id, data-translate-inner, role
  tier2_hierarchy: string;  // XPath or DOM hierarchy + text
  tier3_class: string;      // CSS class cụ thể
}

export const SELECTORS = {
  SIDEBAR_CONVERSATIONS: {
    name: 'SIDEBAR_CONVERSATIONS',
    tier1_semantic: '[data-id="conversation-list"]',
    tier2_hierarchy: 'nav div[tabindex="0"]',
    tier3_class: '#conversationList'
  },
  CHAT_MESSAGE_CONTAINER: {
    name: 'CHAT_MESSAGE_CONTAINER',
    tier1_semantic: '[data-id="message-view-list"]',
    tier2_hierarchy: 'div[role="main"] div[data-scroll="true"]',
    tier3_class: '.chat-message-list'
  },
  CHAT_INPUT_BOX: {
    name: 'CHAT_INPUT_BOX',
    tier1_semantic: '[data-id="chat-input-content"]',
    tier2_hierarchy: 'footer div[contenteditable="true"]',
    tier3_class: '#chat-input-text'
  },
  FORWARD_MODAL: {
    name: 'FORWARD_MODAL',
    tier1_semantic: '[role="dialog"][aria-label*="Chia sẻ"]',
    tier2_hierarchy: 'div.modal-container:has-text("Chia sẻ")',
    tier3_class: '.forward-dialog'
  },
  TOAST_SUCCESS: {
    name: 'TOAST_SUCCESS',
    tier1_semantic: '[data-translate-inner="STR_SHARED_SUCCESS"]',
    tier2_hierarchy: 'div[role="status"]:has-text("Đã chia sẻ")',
    tier3_class: '.toast-success'
  }
} as const;

export function resolveElement(selectorDef: SelectorDefinition): HTMLElement | null {
  // Thử Tier 1
  let el = document.querySelector<HTMLElement>(selectorDef.tier1_semantic);
  if (el) return el;
  // Thử Tier 2
  try {
    el = document.querySelector<HTMLElement>(selectorDef.tier2_hierarchy);
    if (el) return el;
  } catch {
    // Ignore invalid selector syntax nếu có
  }
  // Thử Tier 3
  el = document.querySelector<HTMLElement>(selectorDef.tier3_class);
  return el;
}
```

---

## Negative Space & Invariants (Kiến Trúc Bất Biến)

1. **Khóa Đơn Luồng DOM (Single Mutex Lock FIFO)**: Tuyệt đối không tạo ra 2 luồng Promise cùng thao tác click/chuyển tab trên giao diện Zalo cùng một thời điểm. Mọi tác vụ phải chờ đợi lệnh trước hoàn thành và giải phóng khóa.
2. **Cơ Chế Phục Hồi Khi F5 (Deterministic Resumption)**: Khi trình duyệt bị refresh, trạng thái `PROCESSING` trong `group_dispatch_queue` tự động phục hồi về `PENDING`, đảm bảo không mất tác vụ và không tạo bản ghi mồ côi.
3. **Giới Hạn Phân Phối (Max <= 2 Target Groups)**: Mỗi cụm tin chỉ được phép gửi tới tối đa 2 nhóm con đích để kiểm soát mật độ thông tin và tuân thủ quy tắc chống spam.
4. **Đệm Tĩnh Lặng 10 Giây (Quiescence Inactivity)**: Bắt buộc đệm 10 giây sau khi chuyển tiếp xong trước khi lưu Checkpoint và chuyển sang nhóm khác.

