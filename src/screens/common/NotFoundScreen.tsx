import { useRouter } from '@/configs/router.config';

export interface NotFoundScreenProps {
  attemptedPath?: string;
}

export function NotFoundScreen({ attemptedPath }: NotFoundScreenProps) {
  const router = useRouter();
  const currentPath = attemptedPath || router.currentPath;

  const handleGoHome = () => {
    router.navigate('/');
  };

  const handleGoBack = () => {
    if (router.canGoBack) {
      router.goBack();
    } else {
      router.navigate('/');
    }
  };

  return (
    <div class="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div class="max-w-md w-full bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center space-y-6">
        <div class="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto text-2xl font-bold">
          404
        </div>

        <div class="space-y-2">
          <h1 class="text-xl font-bold text-gray-900">Không tìm thấy trang</h1>
          <p class="text-sm text-gray-500">
            Đường dẫn yêu cầu không hợp lệ hoặc tính năng chưa được kích hoạt.
          </p>
          {currentPath && (
            <p class="text-xs font-mono bg-gray-100 text-gray-700 py-1 px-2 rounded inline-block">
              {currentPath}
            </p>
          )}
        </div>

        <div class="flex justify-center gap-3">
          {router.canGoBack && (
            <button
              type="button"
              onClick={handleGoBack}
              class="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              ← Quay lại
            </button>
          )}
          <button
            type="button"
            onClick={handleGoHome}
            class="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 shadow-sm"
          >
            Về Trang Chủ
          </button>
        </div>
      </div>
    </div>
  );
}
