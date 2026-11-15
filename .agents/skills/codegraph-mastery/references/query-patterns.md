# References: Bảng Tra Cứu Mẫu Query CodeGraph Thực Chiến (WXT & DOM Automation)

Tài liệu tham khảo các mẫu query hiệu năng cao dựa trên thuật toán Personalized PageRank (PPR) của CodeGraph dành cho AI Coding Agent.

---

## 1. Mẫu Query Truy Vết Luồng Nghiệp Vụ (Flow / Pipeline Queries)

| Mục Đích Khảo Sát | Cú Pháp Query Tối Ưu (Bag-of-Symbols) | Phân Tích Đường Đi (Call Path) |
| :--- | :--- | :--- |
| **Phục hồi hàng đợi sau reload tab** | `ZaloAutomationOrchestrator start queueManager initialize queueRepo` | `src/orchestrator.ts` $\rightarrow$ `src/nodes/n02-queue-manager.ts` $\rightarrow$ `src/db/queue-repo.ts` |
| **Quy trình chuyển tiếp tin nhắn Pha 1** | `ForwardAutomator forwardPhase1 SELECTORS resolveElement` | `src/nodes/n08-forward-automator.ts` $\rightarrow$ `src/contracts/selectors.ts` |
| **Thu thập & trích xuất tin nhắn Zalo** | `SidebarObserver attachObserver resolveElement SELECTORS` | `src/nodes/n01-sidebar-observer.ts` $\rightarrow$ `src/contracts/selectors.ts` |
| **Băm dữ liệu khử trùng lặp (Dedup)** | `dedupGate computeContentHash isHashMatch` | `src/nodes/n06-dedup-gate.ts` $\rightarrow$ `src/utils/cryptoHasher.ts` |
| **Định tuyến tin nhắn theo giá** | `priceRouter routeBundle DEFAULT_PRICE_RULES` | `src/nodes/n07-price-router.ts` $\rightarrow$ `src/contracts/schemas.ts` |

---

## 2. Mẫu Query Phân Tích Bán Kính Ảnh Hưởng (Blast Radius & TDD)

| Đối Tượng Thay Đổi / Refactor | Cú Pháp Query CodeGraph | Mục Tiêu Kiểm Soát Blast Radius |
| :--- | :--- | :--- |
| **Thay đổi Interface Storage** | `IFeatureStorageAdapter storage.config.ts` | Bóc tách 10 callers, 3 adapter classes và file test `tests/unit/feature-storage.test.ts` |
| **Thay đổi cấu trúc Schema Tin Nhắn** | `EntityBundle schemas.ts` | Bóc tách các nodes tiêu thụ bundle (`n05`, `n06`, `n07`, `n08`, `n09`) |
| **Kiểm tra bao phủ kiểm thử của Node 01** | `attachObserver n01-sidebar-observer.ts` | Nhận diện cảnh báo `⚠️ no covering tests found` để chặn mutation |
| **Kiểm tra bao phủ kiểm thử của Crypto Hasher** | `isHashMatch cryptoHasher.ts` | Nhận diện file test bao phủ `tests/unit/crypto-hasher.test.ts` |

---

## 3. Mẫu Query Giao Diện & Trạng Thái (Preact Signals & Dexie Storage)

| Mục Đích | Cú Pháp Query | Ghi Chú Kỹ Thuật |
| :--- | :--- | :--- |
| **Cấu hình hàng đợi trong Node 02 View** | `N02QueueManagerView DEFAULT_N02_CONFIG N02Config` | Trích xuất trực tiếp mã nguyên văn có số dòng để edit |
| **Quản lý toạ độ floating panel** | `clampPosition VIEWPORT_PADDING panel-storage.ts` | Giới hạn toạ độ trong viewport tránh tràn màn hình |
| **Điểm kết nối Content Script với Core** | `entrypoints/zalo.content/index.tsx orchestrator start` | Vượt ranh giới WXT Content Script sang Core Orchestrator |

---

## 4. Vùng Cấm Phản Khuôn Mẫu (Anti-Patterns: Không Dùng Cho Non-Code & Metadata)

Tuyệt đối KHÔNG truyền các đối tượng sau vào query của `codegraph_explore`:

| Đối Tượng Bị Cấm | Ví Dụ Query Sai (Anti-Pattern) | Hậu Quả Xảy Ra | Phương Pháp Chuẩn Thay Thế |
| :--- | :--- | :--- | :--- |
| **Tài liệu Markdown** | `query: "specs spec.md plan.md tasks.md"` | Khớp sai vào file code ngẫu nhiên hoặc báo `No relevant code found` | Dùng `read_file("specs/<feature>/spec.md")` |
| **Thư mục dự án** | `query: "specs/002-feature-flagging-routing"` | Đổ hàng trăm dòng code TypeScript chứa chuỗi trùng khớp | Dùng shell `powershell -NoProfile -Command "Get-ChildItem specs"` |
| **Cấu hình JSON/YAML** | `query: ".agents/hooks.json hooks.json"` | CodeGraph bỏ qua JSON hoặc trả về sai AST lân cận | Dùng `read_file(".agents/hooks.json")` |
| **Câu hỏi đàm thoại tự nhiên** | `query: "làm sao để tạo mới tính năng"` | Làm loãng giải thuật PPR, giảm độ chính xác | Đọc tài liệu hướng dẫn trong `Docs/` hoặc dùng lệnh `specify` |
