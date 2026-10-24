/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    // Installable and fully offline: the app shell, fonts and icons are all
    // precached, so after the first visit it runs with no connection.
    VitePWA({
      registerType: 'prompt',
      // Icon files carry the logo's name: browsers and phones cache icons by URL,
      // so a new logo needs new file names to replace an installed app's icon.
      // apple-touch-icon.png stays because iOS also asks for it by that name.
      includeAssets: ['favicon-rank.svg', 'rank-touch-180.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'Prancheta',
        short_name: 'Prancheta',
        description: 'Plan your Jiu-Jitsu classes and teach them from your phone.',
        theme_color: '#F8F9FB',
        background_color: '#FFFFFF',
        display: 'standalone',
        orientation: 'any',
        start_url: '/',
        scope: '/',
        categories: ['sports', 'education', 'productivity'],
        icons: [
          { src: 'rank-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'rank-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'rank-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: 'index.html',
      },
    }),
  ],
  // Railway mounts a cache volume at node_modules/.vite; keep Vite's cache elsewhere.
  cacheDir: '.vite-cache',
  test: {
    environment: 'jsdom',
    globals: true,
  },
});
