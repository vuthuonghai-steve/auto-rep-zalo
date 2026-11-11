export function CollectorPlaceholderView() {
  return (
    <div class="bg-white border border-gray-200 rounded-xl p-8 text-center space-y-4">
      <div class="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto text-2xl">
        📥
      </div>
      <div class="space-y-1">
        <h3 class="text-lg font-semibold text-gray-900">
          Bộ Thu Thập Tin Nhắn Nguồn (Node 1 - Node 3)
        </h3>
        <p class="text-sm text-gray-500 max-w-md mx-auto">
          Slot tích hợp cho observer sidebar, phát hiện hội thoại có tin nhắn mới và trích xuất nội
          dung từ DOM theo thời gian thực.
        </p>
      </div>
      <div class="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 text-amber-800 rounded-md text-xs font-medium">
        <span>🚧 Module đang sẵn sàng tiếp nhận cấu hình nâng cao</span>
      </div>
    </div>
  );
}
