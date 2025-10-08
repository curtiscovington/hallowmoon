import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packageJson = JSON.parse(
  readFileSync(path.resolve(__dirname, 'package.json'), 'utf-8')
);

const appVersion = packageJson.version;

export default defineConfig({
  base: '/hallowmoon/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['offline.html'],
      manifest: {
        id: '/hallowmoon/',
        name: 'HallowMoon',
        short_name: 'HallowMoon',
        start_url: '/hallowmoon/',
        scope: '/hallowmoon/',
        display: 'standalone',
        background_color: '#0b0614',
        theme_color: '#2d174d',
        description: 'Offline mythical training and battles.',
        icons: [
          {
            src: '/hallowmoon/icons/maskable-icon.svg',
            sizes: '192x192',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          },
          {
            src: '/hallowmoon/icons/icon.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'any'
          }
        ]
      },
      workbox: {
        cacheId: `hallowmoon-${appVersion}`,
        navigateFallback: '/hallowmoon/offline.html',
        cleanupOutdatedCaches: true,
        globPatterns: ['**/*.{js,css,html,ico,svg,webmanifest}']
      }
    })
  ],
  define: {
    __APP_VERSION__: JSON.stringify(appVersion)
  }
});
