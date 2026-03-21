import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons.svg'],
      manifest: {
        name: 'Readflix',
        short_name: 'Readflix',
        start_url: '/',
        display: 'standalone',
        background_color: '#121212',
        theme_color: '#1976d2',
        icons: [
          {
            src: '/favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        // Precache app shell (JS, CSS, HTML, fonts, images)
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff,woff2}'],
        // Runtime caching rules
        runtimeCaching: [
          {
            // Book files — large, immutable content → CacheFirst
            urlPattern: /\/api\/books\/[^/]+\/file$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'readflix-books-v1',
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            // Book covers — rarely change → CacheFirst
            urlPattern: /\/api\/books\/[^/]+\/cover$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'readflix-covers-v1',
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            // Other API calls → NetworkFirst with fallback
            urlPattern: /\/api\/.*/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'readflix-api-v1',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24, // 1 day
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
              networkTimeoutSeconds: 5,
            },
          },
        ],
      },
    }),
  ],
  server: {
    port: 4173,
    proxy: {
      '/api': 'http://localhost:4003',
    },
  },
})
