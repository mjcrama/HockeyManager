import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Maak een leesbare datum-tijd string: YYYYMMDD-HHMM
const now = new Date();
const buildDate = now.toISOString().split('T')[0].replace(/-/g, '');
const buildTime = now.getHours().toString().padStart(2, '0') + 
                  now.getMinutes().toString().padStart(2, '0');
const buildId = `${buildDate}-${buildTime}`;

export default defineConfig({
  base: '/HockeyManager/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        cacheId: `app-cache-${buildId}`, 
        globPatterns: ['**/*.{js,css,html,svg,ico,png,webp}'],
        navigateFallback: '/HockeyManager/index.html',
        runtimeCaching: [],
        cleanupOutdatedCaches: true, // Verwijdert oude cache-bestanden automatisch
        // Dit zorgt dat de nieuwe SW direct de controle overneemt
        skipWaiting: true,
        clientsClaim: true,
        // Belangrijk: voorkom dat de SW zelf gecached wordt door de browser
        importScripts: [], 
        manifestTransforms: [
          (manifestEntries) => {
            const manifest = manifestEntries.map((entry) => {
              if (entry.url === 'index.html') {
                // Ook de revisie van de HTML krijgt deze stempel
                entry.revision = buildId;
              }
              return entry;
            });
            return { manifest };
          },
        ],
      },
      manifest: {
        id: '/HockeyManager/',
        name: 'Hockey Team Manager',
        short_name: 'Hockey Manager',
        description: 'Manage your hockey team lineup, substitutions and shootouts',
        start_url: '/HockeyManager/',
        scope: '/HockeyManager/',
        display: 'fullscreen',
        display_override: ['fullscreen', 'standalone', 'minimal-ui'],
        background_color: '#080e1a',
        theme_color: '#1565c0',
        orientation: 'portrait',
        shortcuts: [
          {
            name: 'Wedstrijd',
            short_name: 'Wedstrijd',
            url: '/HockeyManager/?tab=matchday',
            icons: [{ src: '/HockeyManager/pwa-192x192.png', sizes: '192x192', type: 'image/png' }],
          },
          {
            name: 'Selectie',
            short_name: 'Selectie',
            url: '/HockeyManager/?tab=roster',
            icons: [{ src: '/HockeyManager/pwa-192x192.png', sizes: '192x192', type: 'image/png' }],
          },
          {
            name: 'Opstelling',
            short_name: 'Opstelling',
            url: '/HockeyManager/?tab=setup',
            icons: [{ src: '/HockeyManager/pwa-192x192.png', sizes: '192x192', type: 'image/png' }],
          },
        ],
        icons: [
          { src: '/HockeyManager/pwa-64x64.png',              sizes: '64x64',     type: 'image/png' },
          { src: '/HockeyManager/pwa-192x192.png',            sizes: '192x192',   type: 'image/png' },
          { src: '/HockeyManager/pwa-512x512.png',            sizes: '512x512',   type: 'image/png' },
          { src: '/HockeyManager/maskable-icon-512x512.png',  sizes: '512x512',   type: 'image/png', purpose: 'maskable' },
          { src: '/HockeyManager/icon.svg',                   sizes: 'any',       type: 'image/svg+xml' },
        ],
      },
    }),
  ],
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    https: {
      cert: './certs/cert.pem',
      key: './certs/key.pem',
    },
  },
  preview: {
    host: true,
    port: 4173,
    strictPort: true,
    https: {
      cert: './certs/cert.pem',
      key: './certs/key.pem',
    },
  },
})
