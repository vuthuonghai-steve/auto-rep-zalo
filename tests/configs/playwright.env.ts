import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const defaultUserDataDir = path.join(
  process.env.LOCALAPPDATA || 'C:\\Users\\ADMIN\\AppData\\Local',
  'Google\\Chrome\\User Data',
);
const defaultProfileDir = 'Profile 1';

export const PLAYWRIGHT_ENV = {
  // Đường dẫn đến Extension đã build
  EXTENSION_PATH: path.resolve(__dirname, '../../.output/chrome-mv3'),
  
  // Cổng và URL mặc định của Chrome DevTools Protocol
  DEFAULT_CDP_PORT: Number(process.env.CDP_PORT || 9222),
  DEFAULT_CDP_URL: process.env.CDP_URL || `http://127.0.0.1:${process.env.CDP_PORT || 9222}`,
  
  // Cấu hình Chrome User Data & Profile Directory
  CHROME_USER_DATA_DIR: process.env.CHROME_USER_DATA_DIR || defaultUserDataDir,
  CHROME_PROFILE_DIR: process.env.CHROME_PROFILE_DIR || defaultProfileDir,
  CHROME_PROFILE_PATH: path.join(
    process.env.CHROME_USER_DATA_DIR || defaultUserDataDir,
    process.env.CHROME_PROFILE_DIR || defaultProfileDir,
  ),
  
  // URL mục tiêu chính
  ZALO_WEB_URL: 'https://chat.zalo.me/',
  
  // Timeout chuẩn cho kịch bản E2E
  ACTION_TIMEOUT_MS: 10000,
  NAVIGATION_TIMEOUT_MS: 30000,
  EXPECT_TIMEOUT_MS: 5000,
  
  // Kênh trình duyệt (Google Chrome)
  BROWSER_CHANNEL: 'chrome',
} as const;
