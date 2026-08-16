import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Proxy /api dan /uploads ke server backend (port 4000) saat pengembangan.
export default defineConfig({
  plugins: [
    react(),
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
