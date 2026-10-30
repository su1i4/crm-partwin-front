import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [
      react(),
      tailwindcss(),
      // PWA: касса открывается из кэша без интернета, на телефоне — как приложение (ТЗ 16.5, 16.6)
      VitePWA({
        registerType: 'autoUpdate',
        injectRegister: 'auto',
        includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
        manifest: {
          name: 'Автозапчасти CRM — касса',
          short_name: 'Касса',
          description: 'Касса и учёт для магазина автозапчастей',
          lang: 'ru',
          start_url: '/pos',
          scope: '/',
          display: 'standalone',
          orientation: 'any',
          background_color: '#e6e2e2',
          theme_color: '#e6e2e2',
          icons: [
            { src: '/pwa-192.png', sizes: '192x192', type: 'image/png' },
            { src: '/pwa-512.png', sizes: '512x512', type: 'image/png' },
            { src: '/pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
          // «Поделиться» фото из WhatsApp → поиск номера (ТЗ 5.3) — приём файла добавим вместе с OCR-поиском
        },
        workbox: {
          navigateFallback: '/index.html',
          navigateFallbackDenylist: [/^\/api\//, /^\/socket\.io\//],
          globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
          maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
          cleanupOutdatedCaches: true,
        },
        devOptions: { enabled: false },
      }),
    ],
    resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            react: ['react', 'react-dom', 'react-router-dom'],
            data: ['@tanstack/react-query', 'axios', 'zustand', 'dayjs'],
            ui: ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu', '@radix-ui/react-popover', '@radix-ui/react-tabs', 'sonner'],
            forms: ['react-hook-form', 'zod', '@hookform/resolvers'],
          },
        },
      },
    },
    server: {
      port: 5173,
      proxy: {
        '/api': { target: env.VITE_API_PROXY || 'http://localhost:3000', changeOrigin: true },
        '/socket.io': { target: env.VITE_API_PROXY || 'http://localhost:3000', ws: true },
      },
    },
  };
});
