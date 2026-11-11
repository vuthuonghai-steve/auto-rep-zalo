export function MessengerPlaceholderView() {
  return (
    <div class="bg-white border border-gray-200 rounded-xl p-8 text-center space-y-4">
      <div class="w-16 h-16 bg-purple-50 text-purple-600 rounded-full flex items-center justify-center mx-auto text-2xl">
        📤
      </div>
      <div class="space-y-1">
        <h3 class="text-lg font-semibold text-gray-900">
          Bộ Phân Phối & Forward Tin Tự Động (Node 4 - Node 10)
        </h3>
        <p class="text-sm text-gray-500 max-w-md mx-auto">
          Slot tích hợp cho pipeline phân loại giá, dedup băm SHA-256, chuyển đổi nhóm hội thoại và
          gửi tin 2 pha qua Zalo DOM Bridge.
        </p>
      </div>
      <div class="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 text-amber-800 rounded-md text-xs font-medium">
        <span>🚧 Module đang sẵn sàng tiếp nhận cấu hình nâng cao</span>
      </div>
    </div>
  );
}
