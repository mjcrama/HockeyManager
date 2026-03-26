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
        navigateFallback: 'index.html',
        runtimeCaching: [],
      },
      manifest: {
        name: 'Hockey Team Manager',
        short_name: 'Hockey',
        description: 'Manage your hockey team lineup, substitutions and shootouts',
        start_url: '/',
        display: 'fullscreen',
        display_override: ['fullscreen', 'standalone', 'minimal-ui'],
        background_color: '#080e1a',
        theme_color: '#1565c0',
        orientation: 'portrait',
        icons: [
          {
            src: '/icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
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
