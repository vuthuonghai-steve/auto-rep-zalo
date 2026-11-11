import { RouterProvider, useRouter } from '@/configs/router.config';
import { initFeatureFlags } from '@/configs/storage.config';
import { NotFoundScreen } from '@/screens/common/NotFoundScreen';
import { FeatureDetailScreen } from '@/screens/features/FeatureDetailScreen';
import { MasterMenuScreen } from '@/screens/menu/MasterMenuScreen';
import { useEffect } from 'preact/hooks';

export function RouterOutlet() {
  const { currentPath } = useRouter();

  if (currentPath === '/') {
    return <MasterMenuScreen />;
  }

  if (currentPath.startsWith('/feature/')) {
    return <FeatureDetailScreen />;
  }

  return <NotFoundScreen />;
}

export interface AppRootProps {
  initialPath?: string;
}

export function AppRoot({ initialPath = '/' }: AppRootProps) {
  useEffect(() => {
    // Khởi tạo feature flags từ adapter storage khi App mount
    initFeatureFlags().catch(() => {
      // Fallback về default flags nếu load storage gặp lỗi
    });
  }, []);

  return (
    <RouterProvider initialPath={initialPath}>
      <div class="min-h-screen bg-gray-50 text-gray-900 font-sans antialiased">
        <RouterOutlet />
      </div>
    </RouterProvider>
  );
}
