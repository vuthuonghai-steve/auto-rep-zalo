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
    plugins: [
      tailwindcss(),
      {
        name: 'utf8-cleaner-plugin',
        generateBundle(_options, bundle) {
          for (const [fileName, chunk] of Object.entries(bundle)) {
            if (chunk.type === 'chunk') {
              let code = chunk.code;
              let changed = false;
              if (code.includes('\uFFFF') || code.includes('\uFFFE')) {
                console.log('[utf8-cleaner-plugin] Sanitizing non-characters in:', fileName);
                code = code.replace(/\uFFFF/g, '\\uFFFF').replace(/\uFFFE/g, '\\uFFFE');
                changed = true;
              }
              if (code.includes('▲') || code.includes('▼') || code.includes('⚙')) {
                console.log('[utf8-cleaner-plugin] Sanitizing raw symbols in:', fileName);
                code = code
                  .replace(/▲/g, '\\u25B2')
                  .replace(/▼/g, '\\u25BC')
                  .replace(/⚙/g, '\\u2699');
                changed = true;
              }
              if (changed) {
                chunk.code = code;
              }
            }
          }
        },
      },
    ],
    esbuild: {
      charset: 'utf8',
    },
    build: {
      rollupOptions: {
        output: {
          generatedCode: {
            preset: 'es2015',
          },
        },
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
  }),
});
