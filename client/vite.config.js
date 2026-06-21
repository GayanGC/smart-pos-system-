import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}']
      },
      manifest: {
        name: 'Smart ERP POS',
        short_name: 'SmartPOS',
        description: 'Offline-First POS and Employee Management System',
        theme_color: '#8b5cf6',
        icons: []
      }
    })
  ],
  server: {
    port: 3000,
    // Proxy API calls to the Express backend — avoids CORS in development
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
})
