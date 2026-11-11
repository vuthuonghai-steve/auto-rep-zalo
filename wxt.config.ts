import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'wxt';
import packageJson from './package.json';

// See https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: 'src',
  entrypointsDir: '../entrypoints',
  manifest: {
    name: 'Zalo Personal Automation 24/7',
    description: 'Hệ thống tự động hóa thu thập, biên tập và phân phối tin nhắn Zalo cá nhân 24/7',
    version: packageJson.version,
    permissions: ['storage', 'unlimitedStorage', 'power'],
    host_permissions: ['https://chat.zalo.me/*'],
    icons: {
      16: 'icons/icon-16.png',
      48: 'icons/icon-48.png',
      128: 'icons/icon-128.png',
    },
  },
  alias: {
    '@': path.resolve(__dirname, './src'),
  },
  vite: () => ({
    plugins: [tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
  }),
});
