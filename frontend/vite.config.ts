import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        runtimeCaching: [
          {
            // Cache API responses (user data, book list, progress)
            urlPattern: /\/api\/(users|books)(\?.*)?$/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: { maxEntries: 50, maxAgeSeconds: 86400 },
              networkTimeoutSeconds: 3,
            },
          },
          {
            // Cache book files for offline reading
            urlPattern: /\/api\/books\/[^/]+\/file$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'book-files',
              expiration: { maxEntries: 30, maxAgeSeconds: 30 * 86400 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Cache book covers
            urlPattern: /\/api\/books\/[^/]+\/cover$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'book-covers',
              expiration: { maxEntries: 100, maxAgeSeconds: 30 * 86400 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Cache progress — network first, fall back to cache
            urlPattern: /\/api\/users\/[^/]+\/(progress|books\/[^/]+\/progress)$/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'progress-cache',
              expiration: { maxEntries: 50, maxAgeSeconds: 86400 },
              networkTimeoutSeconds: 3,
            },
          },
        ],
      },
      manifest: {
        name: 'Ebook Reader',
        short_name: 'EReader',
        description: '跨裝置電子書閱讀平台',
        theme_color: '#1976d2',
        background_color: '#121212',
        display: 'standalone',
        orientation: 'any',
        start_url: '/',
        icons: [
          { src: '/pwa-192x192.svg', sizes: '192x192', type: 'image/svg+xml' },
          { src: '/pwa-192x192.svg', sizes: '512x512', type: 'image/svg+xml' },
          { src: '/pwa-192x192.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'maskable' },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3003',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
