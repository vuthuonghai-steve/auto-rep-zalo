---
trigger: model_decision
description: Quy chuẩn kiến trúc thư mục 3 tầng (Layer 0-1-2) và kỷ luật biên giới module cho dự án WXT Extension + Preact Signals
---

# ARCHITECTURAL HARNESS RULE: DIRECTORY GOVERNANCE & LAYER DISCIPLINE

## 1. Tiên Đề & Mục Tiêu Cốt Lõi
Mục tiêu: Đảm bảo tính toàn vẹn cấu trúc mã nguồn, triệt tiêu lồng ghép thư mục quá sâu (over-nesting), ngăn chặn phụ thuộc chéo vòng quanh (circular dependency), và thiết lập lằn ranh cơ học cho LLM & Developer khi tạo/sửa đổi tệp tin.

---

## 2. Lằn Ranh Đánh Đổi: Cơ Học (Hook Script) vs Nhận Thức (Cognitive Rule)

Hệ thống Harness phân định rạch ròi 2 cơ chế kiểm soát nhằm tối ưu hóa giữa **Tốc độ thực thi (Latency)**, **Độ tin cậy nhị phân (Mechanical Proof)** và **Ngữ cảnh nhận thức (Semantic Judgment)**:

| Phân Vị Kiểm Duyệt | Cơ Chế Thực Thi | Tiêu Chí Phân Định & Lý Do Đánh Đổi |
| :--- | :--- | :--- |
| **Cưỡng Chế Cơ Học (Mechanical Guard)** | **Hook Script (`.agents/scripts/guards/`)** | **Các quy tắc có thể đo lường nhị phân 100% bằng máy**: <br>1. Độ sâu đường dẫn tệp (`Path Depth <= 2` tính từ feature root).<br>2. Cấm import xuyên màn hình ngang hàng (`Cross-screen components import`).<br>3. Kiểm tra sự tồn tại của tệp SSOT types thay vì nhúng inline trong view.<br>*(Lý do: Không phụ thuộc vào sự suy diễn chủ quan của LLM, ngăn chặn lỗi ngay tại `PostToolUse` với Exit Code khác 0).* |
| **Hướng Dẫn Nhận Thức (Cognitive Rule)** | **Rule (`.agents/rules/`) & Agent Prompt** | **Các quy tắc đòi hỏi đánh giá ngữ nghĩa miền nghiệp vụ**: <br>1. Phân định khi nào một hàm là `pure util` hay `domain logic`.<br>2. Quyết định thời điểm "Lifting" một component cục bộ lên Design System dùng chung.<br>3. Thiết kế state phản ứng (Signals) sao cho giảm thiểu Re-render.<br>*(Lý do: Máy móc không thể hiểu hết ý định kiến trúc dài hạn; cần tri thức lập trình phòng thủ của Agent).* |

---

## 3. Kiến Trúc 3 Tầng Bắt Buộc (Layer Invariants)

### Layer 0: Xương Sống Hệ Thống (Structural Spine)
Bảo toàn tuyệt đối ranh giới giữa 3 môi trường thực thi của Extension:
- `entrypoints/`: Chỉ đóng vai trò Facade/Gateway (Background Service Worker, Content Scripts Shadow-DOM, Options Tab). Cấm đặt logic nghiệp vụ nặng hoặc xử lý cơ sở dữ liệu trực tiếp tại đây.
- `src/nodes/`: Pipeline 10 micro-nodes tự động hóa DOM. Mỗi node đại diện cho 1 công đoạn duy nhất.
- `src/screens/`: Module giao diện Dashboard trong Options Page.
- `src/contracts/`: Vùng lưu trữ Hợp đồng dữ liệu (Zod Schemas, IPC Messaging Protocol, DOM Selectors). Là Single Source of Truth (SSOT), không import ngược từ bất kỳ tầng UI nào.
- `src/db/`: Lớp lưu trữ Dexie IndexedDB theo Repository Pattern.
- `src/components/ui/`: Thư viện thành phần dùng chung (Design System Primitives).

### Layer 1: Cấu Trúc Module Phẳng (Flat Module Boundary)
Áp dụng trực tiếp cho [src/screens](file:///c:/Users/ADMIN/Documents/workspace/Sales/EXTENSIONS/src/screens):
- **Quy tắc Độ Sâu Tối Đa (Max Depth <= 2)**:
  ```text
  src/screens/<screen-name>/
  ├── <ScreenName>Screen.tsx       (Cấp 0: View Container)
  ├── <screen-name>.signals.ts     (Cấp 0: Reactive State Store)
  ├── <screen-name>.types.ts       (Cấp 0: Compile-time Types & Interfaces)
  └── components/                  (Cấp 1: Thư mục con DUY NHẤT chứa UI nội bộ)
      ├── SubComponentA.tsx
      └── SubComponentB.tsx
  ```
- **Cấm Tuyệt Đối**: Cấm tạo thư mục con bên trong `components/`. Cấm gom cụm lồng nhau nhiều tầng như `screens/features/nodes/views/...`.

### Layer 2: Phân Định Phần Tử Nguyên Tử (Element Specialization)
1. **Contract (`src/contracts/*.ts`)**: Zod Schema cho dữ liệu runtime, IPC messages. Bắt buộc có validation.
2. **Type/Interface (`*.types.ts`)**: Compile-time only. Cấm chứa code runtime. Cấm nhúng type inline dài > 5 dòng trong component `.tsx`.
3. **Model (`src/db/models/`)**: Chỉ định nghĩa cấu trúc bảng IndexedDB.
4. **Signal Store (`*.signals.ts`)**: Quản lý reactive state qua Preact Signals. Không chứa thẻ JSX.
5. **Component (`*.tsx`)**: Presentational UI thuần túy. Chỉ bind Signal hoặc nhận Props. Cấm gọi trực tiếp `chrome.*` raw APIs.
6. **Util (`src/utils/*.ts`)**: Pure functions (cùng input $\rightarrow$ cùng output, zero side-effects).

---

## 4. Ma Trận Quy Tắc Bắt Buộc (Negative Space)

- **DIR-INV-001 (No Cross-Screen Import)**: Nghiêm cấm `src/screens/screen-A/` import trực tiếp từ `src/screens/screen-B/components/`. Nếu cần tái sử dụng, bắt buộc phải nâng cấp (Lift) lên `src/components/ui/` hoặc `src/screens/common/`.
- **DIR-INV-002 (No Upward Dependency)**: Cấm các tầng `contracts/`, `db/`, `utils/` import ngược từ `screens/` hay `entrypoints/`.
- **DIR-INV-003 (Max Nesting Limit)**: Mọi tệp UI trong `src/screens/` không được vượt quá độ sâu 2 cấp tính từ `src/screens/`.
- **DIR-INV-004 (Template-First Creation)**: Builder khi tạo mới Screen, Component hoặc Signal bắt buộc phải kế thừa từ các template chuẩn tại `.agents/agents/surgical-implementer/templates/`.

