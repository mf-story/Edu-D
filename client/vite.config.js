import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import legacy from '@vitejs/plugin-legacy'

// Proxy /api dan /uploads ke server backend (port 4000) saat pengembangan.
export default defineConfig({
  plugins: [
    react(),
    // Dukungan browser lama (mis. Smart TV) untuk build produksi.
    legacy({
      targets: ['defaults', 'not IE 11', 'Chrome >= 49', 'Safari >= 10'],
      renderModernChunks: false,
    }),
  ],
  server: {
    // host: true agar dev server bisa diakses dari HP di jaringan yang sama
    // (buka http://<IP-komputer>:5173 dari ponsel).
    host: true,
    port: 5173,
    proxy: {
      '/api': 'http://localhost:4000',
      '/uploads': 'http://localhost:4000',
    },
  },
})
