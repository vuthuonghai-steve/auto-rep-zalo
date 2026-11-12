# Nhóm 4: Breaking Changes & Hướng Dẫn Nâng Cấp

Khi nâng cấp từ `v22.x` lên `v26.x`, cần đặc biệt chú ý các điểm thay đổi sau để tránh lỗi phát sinh.

---

## 1. Các Breaking Changes quan trọng
1. **Xoá hoàn toàn `http.Server.prototype.writeHeader()`:**
   - Phương thức kế thừa cũ này đã bị loại bỏ triệt để.
   - **Giải pháp:** Sử dụng `res.writeHead(...)`.
2. **Loại bỏ các module Stream nội bộ cũ:**
   - Các module wrapper nội bộ `_stream_wrap`, `_stream_readable`, `_stream_writable`, `_stream_duplex`, `_stream_transform`, `_stream_passthrough` đã bị xoá.
   - **Giải pháp:** Chỉ import chuẩn từ `'node:stream'`.
3. **Thay đổi Compiler trên môi trường Windows:**
   - Việc build source Node.js trực tiếp trên Windows hoặc biên dịch Native C++ Addon đã ngừng hỗ trợ Microsoft Visual C++ (MSVC) truyền thống và chuyển sang dùng **ClangCL** (bắt buộc do yêu cầu từ V8). Cần cài `C++ Clang Compiler for Windows` và `MSBuild support for LLVM (clang-cl)` trong Visual Studio Build Tools.
4. **Cập nhật ABI Native Module (`NODE_MODULE_VERSION` = 147):**
   - Các gói npm dùng Native C++ Addon (non-N-API) biên dịch từ v22/v24 sẽ lỗi mismatch ABI. Cần chạy `npm rebuild` hoặc xoá `node_modules` và cài đặt lại.
5. **Loại bỏ cờ `--experimental-transform-types`:**
   - Đã loại bỏ cờ transform type. Cấm dùng `enum` hoặc parameter properties nếu chạy trực tiếp qua native type stripping.
6. **Thay đổi cờ runtime:**
   - Một số cờ thử nghiệm cũ đã được dọn dẹp hoặc ổn định hoá (như `Temporal` và `URLPattern` không cần cờ).

---

## 2. Trạng thái cài đặt trên máy và hướng dẫn hoàn tất nâng cấp

### Nguyên nhân lệnh tự động cần xác nhận quyền Admin:
Trình cài đặt Node.js LTS được đóng gói dưới dạng file MSI hệ thống (`node-v26.13.0-x64.msi`). Do file MSI này ghi đè vào thư mục được bảo vệ `C:\Program Files\nodejs`, Windows sẽ yêu cầu xác nhận UAC (User Access Control / Administrator).

### Cách nâng cấp:

#### Lựa chọn 1: Cài đặt trực tiếp qua file tải chính thức (Khuyên dùng - Rất nhanh)
1. Tải bộ cài MSI chính thức của bản v26 LTS:  
   👉 [https://nodejs.org/dist/v26.13.0/node-v26.13.0-x64.msi](https://nodejs.org/dist/v26.13.0/node-v26.13.0-x64.msi)
2. Mở file `.msi`, nhấn **Next** và chấp nhận ghi đè nâng cấp phiên bản hiện tại.

#### Lựa chọn 2: Chạy Terminal bằng quyền Run as Administrator
Mở **PowerShell với quyền Administrator**, sau đó chạy lệnh:
```powershell
winget install --id OpenJS.NodeJS.LTS --exact
```

Sau khi cài đặt xong, bạn chỉ cần mở terminal mới và kiểm tra lại:
```powershell
node -v   # Kết quả sẽ hiển thị: v26.13.0
npm -v    # Kết quả sẽ hiển thị: 11.20.0
```
