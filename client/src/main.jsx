import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './auth.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)

// Service worker dinonaktifkan sementara: hapus registrasi & cache lama agar
// pengguna tidak terjebak versi usang. (PWA/SW akan dipasang lagi nanti.)
if ('serviceWorker' in navigator) {
  navigator.serviceWorker
    .getRegistrations()
    .then((regs) => regs.forEach((r) => r.unregister()))
    .catch(() => {})
}
if (window.caches) {
  caches.keys().then((keys) => keys.forEach((k) => caches.delete(k))).catch(() => {})
}


