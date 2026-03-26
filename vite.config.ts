import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/HockeyManager/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,ico,png,webp}'],
        navigateFallback: '/HockeyManager/index.html',
        runtimeCaching: [],
      },
      manifest: {
        name: 'Hockey Team Manager',
        short_name: 'Hockey',
        description: 'Manage your hockey team lineup, substitutions and shootouts',
        start_url: '/HockeyManager/',
        scope: '/HockeyManager/',
        display: 'fullscreen',
        display_override: ['fullscreen', 'standalone', 'minimal-ui'],
        background_color: '#080e1a',
        theme_color: '#1565c0',
        orientation: 'portrait',
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
